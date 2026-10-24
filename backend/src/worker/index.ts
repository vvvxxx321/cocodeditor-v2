import dotenv from 'dotenv';
dotenv.config();
process.env.SERVICE_NAME ||= 'worker';

import { logger } from '../logger';
import { createExecutionWorker } from './executionWorker';
import { reconcilePendingEnqueues } from './reconciler';
import { closeExecutionQueue } from '../queue/executionQueue';

const worker = createExecutionWorker();
logger.info({ concurrency: worker.opts.concurrency }, 'execution worker started');

const runReconciler = () => reconcilePendingEnqueues().catch(err => logger.warn({ err }, 'reconciler failed'));
runReconciler();
const timer = setInterval(runReconciler, Number(process.env.RECONCILE_INTERVAL_MS || 30000));

const shutdown = async () => {
  clearInterval(timer);
  await worker.close(); // waits for in-flight jobs
  await closeExecutionQueue();
  process.exit(0);
};
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
