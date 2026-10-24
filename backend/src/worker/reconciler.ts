import { ExecStatus } from '@prisma/client';
import { prisma } from '../database/prismaClient';
import { enqueuePending } from '../services/executionService';
import { logger } from '../logger';

/**
 * Re-enqueues rows stuck in PENDING_ENQUEUE (API committed the row but the enqueue failed and the
 * client never retried). Safe to run concurrently with client retries: jobId = executionId dedupes.
 */
export async function reconcilePendingEnqueues(minAgeMs = Number(process.env.RECONCILE_MIN_AGE_MS || 10000)) {
  const stale = await prisma.executionJob.findMany({
    where: { status: ExecStatus.PENDING_ENQUEUE, createdAt: { lt: new Date(Date.now() - minAgeMs) } },
    select: { id: true }, take: 100,
  });
  let enqueued = 0;
  for (const { id } of stale) {
    try {
      await enqueuePending(id);
      enqueued++;
    } catch (err) {
      logger.warn({ executionId: id, err: (err as Error).message }, 'reconciler enqueue failed');
    }
  }
  if (enqueued) logger.info({ enqueued }, 'reconciler re-enqueued pending executions');
  return enqueued;
}
