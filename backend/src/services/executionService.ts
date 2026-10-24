import { createHash } from 'crypto';
import { ExecStatus, ExecutionJob, Prisma } from '@prisma/client';
import { prisma } from '../database/prismaClient';
import { enqueueExecution } from '../queue/executionQueue';

export const TERMINAL: ExecStatus[] = [ExecStatus.SUCCEEDED, ExecStatus.FAILED, ExecStatus.TIMED_OUT];

export interface ExecutionRequest {
  userId: string;
  projectId: string;
  fileId?: string | null;
  idempotencyKey: string;
  language: string;
  sourceCode: string;
  stdin?: string;
}

export class IdempotencyConflictError extends Error {}

export const requestHashOf = (r: ExecutionRequest) =>
  createHash('sha256')
    .update(JSON.stringify([r.projectId, r.fileId ?? null, r.language, r.sourceCode, r.stdin ?? '']))
    .digest('hex');

/** Public view of a job (never returns source code or the Judge0 token). */
export const toView = (j: ExecutionJob) => ({
  id: j.id, status: j.status, attempts: j.attempts, language: j.language, projectId: j.projectId, fileId: j.fileId,
  stdout: j.stdout, stderr: j.stderr, compileOutput: j.compileOutput, statusDescription: j.judge0Status,
  timeMs: j.timeMs, memoryKb: j.memoryKb, error: j.error,
  createdAt: j.createdAt, enqueuedAt: j.enqueuedAt, startedAt: j.startedAt, finishedAt: j.finishedAt,
});

/** Enqueue a PENDING_ENQUEUE row and mark it QUEUED. Safe to call repeatedly for the same row. */
export async function enqueuePending(id: string) {
  await enqueueExecution(id);
  await prisma.executionJob.updateMany({
    where: { id, status: ExecStatus.PENDING_ENQUEUE },
    data: { status: ExecStatus.QUEUED, enqueuedAt: new Date() },
  });
}

/**
 * Idempotent create-or-replay.
 * - New key: insert PENDING_ENQUEUE, then enqueue.
 * - Same key, same request: return the existing row; if it is still PENDING_ENQUEUE (an earlier
 *   enqueue failed), retry the enqueue. Same key, different request: IdempotencyConflictError.
 * Returns { job, created, enqueueError }. Enqueue failure leaves the row PENDING_ENQUEUE (never
 * FAILED), so the client can retry with the same key and the worker reconciler can pick it up.
 */
export async function submitExecution(req: ExecutionRequest) {
  const requestHash = requestHashOf(req);
  let job: ExecutionJob;
  let created = false;
  try {
    job = await prisma.executionJob.create({
      data: {
        userId: req.userId, projectId: req.projectId, fileId: req.fileId ?? null, idempotencyKey: req.idempotencyKey,
        requestHash, language: req.language, sourceCode: req.sourceCode, stdin: req.stdin ?? '',
      },
    });
    created = true;
  } catch (err) {
    if (!(err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002')) throw err;
    job = await prisma.executionJob.findUniqueOrThrow({
      where: { userId_idempotencyKey: { userId: req.userId, idempotencyKey: req.idempotencyKey } },
    });
    if (job.requestHash !== requestHash) throw new IdempotencyConflictError('Idempotency-Key reused with a different request');
  }

  let enqueueError: Error | null = null;
  if (job.status === ExecStatus.PENDING_ENQUEUE) {
    try {
      await enqueuePending(job.id);
      job = await prisma.executionJob.findUniqueOrThrow({ where: { id: job.id } });
    } catch (err) {
      enqueueError = err as Error;
    }
  }
  return { job, created, enqueueError };
}
