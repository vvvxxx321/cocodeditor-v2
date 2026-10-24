/**
 * Tier T2 (mocked external): real PostgreSQL + real Redis/BullMQ + real worker code, against a
 * FAKE Judge0. Crash tests run the worker as a separate OS process and SIGKILL it.
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import { spawn, ChildProcess } from 'child_process';
import { randomUUID } from 'crypto';
import path from 'path';
import { Worker } from 'bullmq';
import { prisma } from '../src/database/prismaClient';
import { createApp } from '../src/index';
import { createExecutionWorker } from '../src/worker/executionWorker';
import { reconcilePendingEnqueues } from '../src/worker/reconciler';
import { closeExecutionQueue, getExecutionQueue } from '../src/queue/executionQueue';
import { resetDb, seedFixture, signToken, waitFor, Fixture } from './helpers';
import { startFakeJudge0, FakeJudge0 } from './fakes/fakeJudge0';
import { TestRedis, freePort } from './fakes/redisServer';

const app = createApp();
let f: Fixture;
let judge0: FakeJudge0;
let redis: TestRedis;
const tok: Record<string, string> = {};
const auth = (who: string) => ({ Authorization: `Bearer ${tok[who]}` });

const WORKER_ENV = {
  EXEC_TIMEOUT_MS: '1500', EXEC_POLL_MS: '50', EXEC_BACKOFF_MS: '100', EXEC_MAX_ATTEMPTS: '3',
  WORKER_LOCK_MS: '1500', WORKER_STALLED_INTERVAL_MS: '500', WORKER_CONCURRENCY: '4', ENQUEUE_TIMEOUT_MS: '1000',
};

beforeAll(async () => {
  await resetDb();
  f = await seedFixture();
  for (const who of ['member', 'viewer', 'outsider'] as const) tok[who] = await signToken(f[who]);
  judge0 = await startFakeJudge0();
  redis = new TestRedis(await freePort());
  await redis.start();
  Object.assign(process.env, WORKER_ENV, { REDIS_URL: redis.url, JUDGE0_API_URL: judge0.url, JUDGE0_API_KEY: '' });
});

afterAll(async () => {
  await closeExecutionQueue();
  await redis.stop();
  await judge0.close();
  await prisma.$disconnect();
});

const run = (body: Record<string, unknown>, key = randomUUID(), who = 'member') =>
  request(app).post('/api/executions').set(auth(who)).set('Idempotency-Key', key)
    .send({ projectId: f.projectId, language: 'python', code: 'print(1)', ...body });
const row = (id: string) => prisma.executionJob.findUniqueOrThrow({ where: { id } });
const waitTerminal = (id: string, ms = 15000) =>
  waitFor(async () => ['SUCCEEDED', 'FAILED', 'TIMED_OUT'].includes((await row(id)).status), ms, 50);

describe('T2 execution pipeline (in-process worker)', () => {
  let worker: Worker;
  beforeAll(() => { worker = createExecutionWorker(); });
  afterAll(async () => { await worker.close(); });
  beforeEach(() => judge0.reset());

  it('happy path: 202 -> QUEUED -> SUCCEEDED with output', async () => {
    const res = await run({ code: 'print("hi")' }).expect(202);
    expect(['QUEUED', 'RUNNING', 'SUCCEEDED']).toContain(res.body.status);
    await waitTerminal(res.body.id);
    const view = (await request(app).get(`/api/executions/${res.body.id}`).set(auth('member')).expect(200)).body;
    expect(view.status).toBe('SUCCEEDED');
    expect(view.statusDescription).toBe('Accepted');
    expect(view.stdout).toBe('ran 11 bytes\n');
    expect(view.attempts).toBe(1);
    expect(view.sourceCode).toBeUndefined();
    expect(judge0.submissions).toBe(1);
  });

  it('idempotency: same key twice -> one row, one Judge0 submission', async () => {
    const key = randomUUID();
    const a = await run({}, key).expect(202);
    const b = await run({}, key).expect(200);
    expect(b.body.id).toBe(a.body.id);
    await waitTerminal(a.body.id);
    await run({}, key).expect(200);
    await new Promise(r => setTimeout(r, 300));
    expect(await prisma.executionJob.count({ where: { idempotencyKey: key } })).toBe(1);
    expect(judge0.submissions).toBe(1);
  });

  it('same key with a different request body -> 409', async () => {
    const key = randomUUID();
    await run({ code: 'print(1)' }, key).expect(202);
    await run({ code: 'print(2)' }, key).expect(409);
  });

  it('retryable 503 twice then OK -> SUCCEEDED on attempt 3', async () => {
    judge0.setMode({ kind: 'fail-submit', times: 2 });
    const res = await run({}).expect(202);
    await waitTerminal(res.body.id);
    const r = await row(res.body.id);
    expect(r.status).toBe('SUCCEEDED');
    expect(r.attempts).toBe(3);
    expect(judge0.postAttempts).toBe(3);
    expect(judge0.submissions).toBe(1);
  });

  it('always 503 -> FAILED after exactly 3 bounded attempts', async () => {
    judge0.setMode({ kind: 'always-fail-submit' });
    const res = await run({}).expect(202);
    await waitTerminal(res.body.id);
    const r = await row(res.body.id);
    expect(r.status).toBe('FAILED');
    expect(r.attempts).toBe(3);
    expect(r.error).toMatch(/Gave up after 3 attempts/);
    expect(judge0.postAttempts).toBe(3);
  });

  it('4xx from Judge0 is permanent -> FAILED without retry', async () => {
    judge0.setMode({ kind: 'always-fail-submit', status: 422 });
    const res = await run({}).expect(202);
    await waitTerminal(res.body.id);
    const r = await row(res.body.id);
    expect(r.status).toBe('FAILED');
    expect(r.attempts).toBe(1);
    expect(judge0.postAttempts).toBe(1);
  });

  it('Judge0 never finishes -> TIMED_OUT (bounded), not retried', async () => {
    judge0.setMode({ kind: 'hang' });
    const res = await run({}).expect(202);
    await waitTerminal(res.body.id);
    const r = await row(res.body.id);
    expect(r.status).toBe('TIMED_OUT');
    expect(r.attempts).toBe(1);
    expect(r.finishedAt!.getTime() - r.startedAt!.getTime()).toBeLessThan(5000);
  });

  it('compile error is a terminal verdict (SUCCEEDED run, no retry)', async () => {
    judge0.setMode({ kind: 'compile-error' });
    const res = await run({ language: 'cpp', code: 'int main( {}' }).expect(202);
    await waitTerminal(res.body.id);
    const r = await row(res.body.id);
    expect(r.status).toBe('SUCCEEDED');
    expect(r.judge0Status).toBe('Compilation Error');
    expect(r.compileOutput).toContain('expected');
    expect(r.attempts).toBe(1);
  });

  it('RBAC and validation: viewer 403, outsider 404, missing key 400, bad language 400', async () => {
    await run({}, randomUUID(), 'viewer').expect(403);
    await run({}, randomUUID(), 'outsider').expect(404);
    await request(app).post('/api/executions').set(auth('member')).send({ projectId: f.projectId, language: 'python', code: 'x' }).expect(400);
    await run({ language: 'brainfuck' }).expect(400);
    const res = await run({}).expect(202);
    await request(app).get(`/api/executions/${res.body.id}`).set(auth('outsider')).expect(404);
  });
});

describe('T2 Redis outage at enqueue', () => {
  let worker: Worker | null = null;
  afterEach(async () => { if (worker) { await worker.close(); worker = null; } });

  it('returns 503, keeps the row PENDING_ENQUEUE, and a retry with the same key enqueues exactly once', async () => {
    judge0.reset();
    await getExecutionQueue().waitUntilReady();
    await redis.stop();
    const key = randomUUID();
    const down = await run({}, key);
    expect(down.status).toBe(503);
    expect(down.headers['retry-after']).toBe('2');
    expect((await row(down.body.id)).status).toBe('PENDING_ENQUEUE');

    await redis.start();
    const retry = await run({}, key);
    expect([200, 202]).toContain(retry.status);
    expect(retry.body.id).toBe(down.body.id);
    expect((await row(down.body.id)).status).toBe('QUEUED');
    // Enqueue again (simulating a lost ack + another retry): jobId dedupes.
    await getExecutionQueue().add('run', { executionId: down.body.id }, { jobId: down.body.id });
    expect(await getExecutionQueue().getJobCounts('waiting')).toMatchObject({ waiting: 1 });

    worker = createExecutionWorker();
    await waitTerminal(down.body.id);
    expect((await row(down.body.id)).status).toBe('SUCCEEDED');
    expect(judge0.submissions).toBe(1);
  });

  it('reconciler enqueues a PENDING_ENQUEUE row whose client never retried', async () => {
    judge0.reset();
    await redis.stop();
    const down = await run({});
    expect(down.status).toBe(503);
    await redis.start();
    expect(await reconcilePendingEnqueues(0)).toBeGreaterThanOrEqual(1);
    worker = createExecutionWorker();
    await waitTerminal(down.body.id);
    expect((await row(down.body.id)).status).toBe('SUCCEEDED');
  });
});

describe('T2 worker crash recovery (separate worker process, SIGKILL)', () => {
  const children: ChildProcess[] = [];
  const spawnWorker = (extraEnv: Record<string, string> = {}) => {
    // `node --import tsx` (not the `tsx` CLI): the CLI runs the script in a *child* node process, so
    // SIGKILL on the CLI's pid would leave the real worker running (found the hard way, see 03 doc).
    const child = spawn(process.execPath, ['--import', 'tsx', 'src/worker/index.ts'], {
      cwd: path.join(__dirname, '..'),
      env: { ...process.env, ...WORKER_ENV, NODE_ENV: 'test', LOG_LEVEL: 'silent', REDIS_URL: redis.url, JUDGE0_API_URL: judge0.url, RECONCILE_INTERVAL_MS: '600000', EXEC_TIMEOUT_MS: '10000', ...extraEnv },
      stdio: 'ignore',
    });
    children.push(child);
    return child;
  };
  const exited = (c: ChildProcess) => new Promise<number | null>(r => (c.exitCode !== null || c.signalCode) ? r(c.exitCode) : c.once('exit', code => r(code)));
  afterEach(async () => {
    for (const c of children.splice(0)) { if (c.exitCode === null && !c.signalCode) { c.kill('SIGKILL'); await exited(c); } }
  });

  it('crash AFTER the token is persisted: restarted worker resumes polling, 1 submission', async () => {
    judge0.reset();
    judge0.setMode({ kind: 'ok', processingMs: 2500 });
    const first = spawnWorker();
    const res = await run({}).expect(202);
    await waitFor(async () => !!(await row(res.body.id)).judge0Token, 10000);
    first.kill('SIGKILL');
    await exited(first);
    spawnWorker();
    await waitTerminal(res.body.id, 20000);
    const r = await row(res.body.id);
    expect(r.status).toBe('SUCCEEDED');
    expect(judge0.submissions).toBe(1);
  });

  it('crash INSIDE the submit->persist window: documented at-least-once (2 submissions, still 1 result row)', async () => {
    judge0.reset();
    const first = spawnWorker({ EXEC_FAULT_CRASH_AFTER_SUBMIT: '1' });
    const res = await run({}).expect(202);
    await exited(first); // the fault hook SIGKILLs itself right after Judge0 accepted the submission
    expect(judge0.submissions).toBe(1);
    expect((await row(res.body.id)).judge0Token).toBeNull(); // the token was never committed

    spawnWorker();
    await waitTerminal(res.body.id, 20000);
    const r = await row(res.body.id);
    expect(r.status).toBe('SUCCEEDED');
    expect(judge0.submissions).toBe(2); // duplicate external execution: the known limitation
    expect(await prisma.executionJob.count({ where: { id: res.body.id } })).toBe(1);
  });
});
