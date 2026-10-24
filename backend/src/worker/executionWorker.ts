import { Job, Worker } from 'bullmq';
import { ExecStatus } from '@prisma/client';
import { prisma } from '../database/prismaClient';
import { createRedis } from '../queue/connection';
import { EXECUTION_QUEUE, ExecutionJobData } from '../queue/executionQueue';
import { getSubmission, isPending, PermanentError, RetryableError, submit } from '../utils/judge0Client';
import { TERMINAL } from '../services/executionService';
import { logger as baseLogger } from '../logger';

const logger = baseLogger.child({ component: 'execution-worker' });
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

/**
 * Processes one execution job.
 *
 * Delivery guarantees:
 * - Application result: exactly one terminal result per row. Terminal rows are never reprocessed,
 *   and results are written with a conditional update (status = RUNNING).
 * - External execution: AT-LEAST-ONCE. If the worker dies after Judge0 accepted a submission but
 *   before the token was committed, the retry cannot know about it and submits again. Judge0 has
 *   no client-supplied idempotency key, so this window cannot be closed from our side.
 *   Once the token is committed, retries poll the existing submission instead of resubmitting.
 */
export async function processExecution(job: Job<ExecutionJobData>) {
  const id = job.data.executionId;
  const log = logger.child({ executionId: id, jobId: job.id, attempt: job.attemptsMade + 1 });
  const row = await prisma.executionJob.findUnique({ where: { id } });
  if (!row) return { skipped: 'missing' };
  if (TERMINAL.includes(row.status)) return { skipped: 'terminal' };

  const claimed = await prisma.executionJob.updateMany({
    where: { id, status: { in: [ExecStatus.PENDING_ENQUEUE, ExecStatus.QUEUED, ExecStatus.RUNNING] } },
    data: { status: ExecStatus.RUNNING, attempts: { increment: 1 }, startedAt: row.startedAt ?? new Date() },
  });
  if (claimed.count === 0) return { skipped: 'terminal' };

  const finish = (data: Parameters<typeof prisma.executionJob.updateMany>[0]['data']) =>
    prisma.executionJob.updateMany({ where: { id, status: ExecStatus.RUNNING }, data: { ...data, finishedAt: new Date() } });

  const isFinalAttempt = job.attemptsMade + 1 >= (job.opts.attempts ?? 1);
  try {
    let token = row.judge0Token;
    if (token) {
      log.info('resuming existing Judge0 submission (no resubmit)');
    } else {
      token = await submit(row.sourceCode, row.language, row.stdin);
      // Test-only fault injection for the documented crash window (never read outside NODE_ENV=test).
      if (process.env.NODE_ENV === 'test' && process.env.EXEC_FAULT_CRASH_AFTER_SUBMIT === '1') {
        process.kill(process.pid, 'SIGKILL');
      }
      await prisma.executionJob.update({ where: { id }, data: { judge0Token: token, submittedAt: new Date() } });
      log.info('submitted to Judge0');
    }

    const deadline = Date.now() + Number(process.env.EXEC_TIMEOUT_MS || 20000);
    const pollMs = Number(process.env.EXEC_POLL_MS || 500);
    for (;;) {
      const result = await getSubmission(token);
      if (!isPending(result.statusId)) {
        if (result.statusId === 13) {
          // Judge0 internal error: resubmit on the next attempt.
          await prisma.executionJob.update({ where: { id }, data: { judge0Token: null } });
          throw new RetryableError(`Judge0 internal error: ${result.message ?? ''}`);
        }
        await finish({
          status: ExecStatus.SUCCEEDED, judge0Status: result.statusDescription, stdout: result.stdout,
          stderr: result.stderr, compileOutput: result.compileOutput, timeMs: result.timeMs, memoryKb: result.memoryKb,
          error: null,
        });
        log.info({ judge0Status: result.statusDescription, durationMs: Date.now() - row.createdAt.getTime() }, 'execution finished');
        return { status: ExecStatus.SUCCEEDED };
      }
      if (Date.now() > deadline) {
        await finish({ status: ExecStatus.TIMED_OUT, error: 'Execution did not complete before the deadline' });
        log.warn('execution timed out');
        return { status: ExecStatus.TIMED_OUT };
      }
      await sleep(pollMs);
    }
  } catch (err) {
    if (err instanceof PermanentError) {
      await finish({ status: ExecStatus.FAILED, error: err.message });
      log.warn({ err: err.message }, 'execution failed permanently (no retry)');
      return { status: ExecStatus.FAILED };
    }
    if (isFinalAttempt) {
      await finish({ status: ExecStatus.FAILED, error: `Gave up after ${job.attemptsMade + 1} attempts: ${(err as Error).message}` });
      log.error({ err: (err as Error).message }, 'execution failed after final attempt');
    } else {
      // Back to QUEUED while BullMQ waits for the backoff.
      await prisma.executionJob.updateMany({ where: { id, status: ExecStatus.RUNNING }, data: { status: ExecStatus.QUEUED } });
      log.warn({ err: (err as Error).message }, 'retryable execution error');
    }
    throw err; // let BullMQ apply attempts/backoff
  }
}

export function createExecutionWorker() {
  const worker = new Worker<ExecutionJobData>(EXECUTION_QUEUE, processExecution, {
    connection: createRedis(),
    concurrency: Number(process.env.WORKER_CONCURRENCY || 4),
    // A crashed worker's job becomes "stalled" after the lock expires and is retried by another worker.
    lockDuration: Number(process.env.WORKER_LOCK_MS || 30000),
    stalledInterval: Number(process.env.WORKER_STALLED_INTERVAL_MS || 30000),
    maxStalledCount: 2,
  });
  worker.on('error', err => logger.error({ err }, 'worker error'));
  return worker;
}
