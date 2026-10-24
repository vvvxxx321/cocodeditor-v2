import IORedis, { RedisOptions } from 'ioredis';

export const redisUrl = () => process.env.REDIS_URL || 'redis://127.0.0.1:6379';

/** BullMQ workers require maxRetriesPerRequest: null (blocking commands). */
export function createRedis(opts: RedisOptions = {}) {
  return new IORedis(redisUrl(), { maxRetriesPerRequest: null, ...opts });
}
