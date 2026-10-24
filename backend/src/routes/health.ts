import express from 'express';
import type Redis from 'ioredis';
import { prisma } from '../database/prismaClient';
import { createRedis } from '../queue/connection';

/** Liveness (process up) and readiness (dependencies reachable) probes. */
const router = express.Router();
let redis: Redis | null = null;

router.get('/healthz', (_req, res) => {
  res.json({ status: 'ok', uptimeSec: Math.round(process.uptime()) });
});

router.get('/readyz', async (_req, res) => {
  const checks: Record<string, string> = {};
  const timeout = <T>(p: Promise<T>) => Promise.race([p, new Promise<never>((_, r) => setTimeout(() => r(new Error('timeout')), 1000))]);
  try { await timeout(prisma.$queryRaw`SELECT 1`); checks.database = 'ok'; } catch (e) { checks.database = (e as Error).message; }
  if (process.env.REDIS_URL) {
    redis ??= createRedis({ maxRetriesPerRequest: 1, lazyConnect: true });
    try { await timeout(redis.ping()); checks.redis = 'ok'; } catch (e) { checks.redis = (e as Error).message; }
  }
  const ready = Object.values(checks).every(v => v === 'ok');
  res.status(ready ? 200 : 503).json({ status: ready ? 'ready' : 'not_ready', checks });
});

export default router;
