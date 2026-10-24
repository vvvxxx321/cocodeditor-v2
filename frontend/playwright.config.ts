import { defineConfig } from '@playwright/test';

/**
 * Tier T5: browser E2E with LOCAL test auth. global-setup starts isolated API/collab/worker/Vite
 * processes and a fake Judge0, seeds an E2E database, and mints HS256 tokens with a per-run secret.
 * This verifies UI wiring end to end; it does NOT verify real Supabase sign-in (tier T6).
 */
export default defineConfig({
  testDir: './e2e',
  globalSetup: './e2e/global-setup.ts',
  timeout: 60_000,
  workers: 1,
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'playwright-report' }]],
  use: {
    baseURL: 'http://localhost:5300',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
});
