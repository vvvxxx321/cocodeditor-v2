import { defineConfig } from 'vitest/config';
import { randomBytes } from 'crypto';
import os from 'os';

// Tests always run against the dedicated local test database, with a random per-run HS256
// secret. Nothing here is used by the production code path except through env vars.
const user = process.env.PGUSER || os.userInfo().username;
const testDb = process.env.TEST_DATABASE_URL || `postgresql://${user}@localhost:5432/cocodeditor_v2_test`;

export default defineConfig({
  test: {
    include: ['test/**/*.test.ts'],
    fileParallelism: false,
    testTimeout: 30000,
    hookTimeout: 60000,
    env: {
      NODE_ENV: 'test',
      DATABASE_URL: testDb,
      DIRECT_URL: testDb,
      SUPABASE_URL: '',
      SUPABASE_SERVICE_ROLE_KEY: '',
      SUPABASE_JWT_SECRET: randomBytes(32).toString('hex'),
      REDIS_URL: process.env.TEST_REDIS_URL || 'redis://127.0.0.1:6379/15',
      COLLAB_INTERNAL_SECRET: randomBytes(16).toString('hex'),
    },
  },
});
