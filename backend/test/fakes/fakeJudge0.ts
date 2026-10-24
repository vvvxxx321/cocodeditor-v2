import express from 'express';
import http from 'http';
import { randomUUID } from 'crypto';

/**
 * Minimal fake of the Judge0 CE submissions API (base64 mode) for deterministic failure tests.
 * This is a test double, not Judge0: results are canned, nothing is executed.
 */
export type Mode =
  | { kind: 'ok'; stdout?: string; processingMs?: number }
  | { kind: 'fail-submit'; times: number; status?: number }   // first N POSTs fail with status (default 503)
  | { kind: 'always-fail-submit'; status?: number }
  | { kind: 'hang' }                                          // never leaves "Processing"
  | { kind: 'compile-error' };

export interface FakeJudge0 {
  url: string;
  submissions: number;          // successful POST /submissions (i.e. Judge0 accepted work)
  postAttempts: number;         // all POST attempts, including rejected ones
  setMode(m: Mode): void;
  reset(): void;
  close(): Promise<void>;
}

const b64 = (s: string) => Buffer.from(s).toString('base64');

export async function startFakeJudge0(): Promise<FakeJudge0> {
  let mode: Mode = { kind: 'ok' };
  let failuresLeft = 0;
  const subs = new Map<string, { at: number; mode: Mode; source: string }>();
  const state = { submissions: 0, postAttempts: 0 };
  const app = express();
  app.use(express.json());

  app.post('/submissions', (req, res) => {
    state.postAttempts++;
    if (mode.kind === 'always-fail-submit') return void res.status(mode.status ?? 503).json({ error: 'unavailable' });
    if (mode.kind === 'fail-submit' && failuresLeft > 0) {
      failuresLeft--;
      return void res.status(mode.status ?? 503).json({ error: 'unavailable' });
    }
    const token = randomUUID();
    subs.set(token, { at: Date.now(), mode, source: Buffer.from(req.body.source_code || '', 'base64').toString() });
    state.submissions++;
    res.status(201).json({ token });
  });

  app.get('/submissions/:token', (req, res) => {
    const s = subs.get(req.params.token);
    if (!s) return void res.status(404).json({ error: 'not found' });
    const processing = { status: { id: 2, description: 'Processing' } };
    if (s.mode.kind === 'hang') return void res.json(processing);
    if (s.mode.kind === 'ok' && Date.now() - s.at < (s.mode.processingMs ?? 0)) return void res.json(processing);
    if (s.mode.kind === 'compile-error') {
      return void res.json({ status: { id: 6, description: 'Compilation Error' }, compile_output: b64('error: expected ;'), stdout: null, stderr: null, time: null, memory: null });
    }
    const stdout = s.mode.kind === 'ok' && s.mode.stdout !== undefined ? s.mode.stdout : `ran ${s.source.length} bytes\n`;
    res.json({ status: { id: 3, description: 'Accepted' }, stdout: b64(stdout), stderr: null, compile_output: null, time: '0.012', memory: 3200 });
  });

  const server = http.createServer(app);
  await new Promise<void>(r => server.listen(0, '127.0.0.1', () => r()));
  const port = (server.address() as any).port;
  return {
    url: `http://127.0.0.1:${port}`,
    get submissions() { return state.submissions; },
    get postAttempts() { return state.postAttempts; },
    setMode(m) { mode = m; failuresLeft = m.kind === 'fail-submit' ? m.times : 0; },
    reset() { state.submissions = 0; state.postAttempts = 0; mode = { kind: 'ok' }; failuresLeft = 0; },
    close: () => new Promise(r => server.close(() => r())),
  } as FakeJudge0;
}
