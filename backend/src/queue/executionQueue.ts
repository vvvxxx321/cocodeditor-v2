import { Queue } from 'bullmq';
import { createRedis } from './connection';

export const EXECUTION_QUEUE = 'execution';

export interface ExecutionJobData {
  executionId: string;
}

let queue: Queue<ExecutionJobData> | null = null;

export function getExecutionQueue() {
  if (!queue) {
    queue = new Queue<ExecutionJobData>(EXECUTION_QUEUE, {
      // Bounded per-command retries so an enqueue during a Redis outage fails instead of hanging.
      connection: createRedis({ maxRetriesPerRequest: 1 }),
      defaultJobOptions: {
        attempts: Number(process.env.EXEC_MAX_ATTEMPTS || 3),
        backoff: { type: 'exponential', delay: Number(process.env.EXEC_BACKOFF_MS || 1000) },
        removeOnComplete: { age: 3600, count: 1000 },
        removeOnFail: { age: 24 * 3600 },
      },
    });
    queue.on('error', () => { /* surfaced through enqueue failures */ });
  }
  return queue;
}

const withTimeout = <T>(p: Promise<T>, ms: number) =>
  Promise.race([p, new Promise<never>((_, reject) => setTimeout(() => reject(new Error(`enqueue timed out after ${ms}ms`)), ms))]);

/**
 * jobId = executionId makes enqueue idempotent: if a previous add() actually reached Redis but
 * its acknowledgement was lost, re-adding the same id is a no-op instead of a duplicate job.
 */
export function enqueueExecution(executionId: string) {
  return withTimeout(
    getExecutionQueue().add('run', { executionId }, { jobId: executionId }),
    Number(process.env.ENQUEUE_TIMEOUT_MS || 2000),
  );
}

export async function closeExecutionQueue() {
  if (queue) {
    const q = queue;
    queue = null;
    await q.close().catch(() => undefined);
  }
}
