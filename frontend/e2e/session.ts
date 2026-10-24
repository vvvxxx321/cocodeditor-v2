import { BrowserContext, Page } from '@playwright/test';

export const data = () => JSON.parse(process.env.E2E_DATA!) as {
  projectId: string; fileId: string;
  users: Record<'alice' | 'bob', { id: string; email: string; token: string }>;
};

/**
 * Puts a session into localStorage under supabase-js's storage key (sb-<host>-auth-token) before the
 * app loads, so supabase.auth.getSession() returns it without a network call. The token is a
 * locally signed HS256 JWT validated by the local backend (tier T5, not real Supabase sign-in).
 */
export async function signIn(context: BrowserContext, who: 'alice' | 'bob') {
  const u = data().users[who];
  const now = Math.floor(Date.now() / 1000);
  const session = {
    access_token: u.token, refresh_token: 'e2e-refresh-placeholder', token_type: 'bearer',
    expires_in: 7200, expires_at: now + 7200,
    user: { id: u.id, aud: 'authenticated', role: 'authenticated', email: u.email, app_metadata: {}, user_metadata: {}, created_at: new Date().toISOString() },
  };
  await context.addInitScript(([key, value]) => { window.localStorage.setItem(key, value); },
    ['sb-localhost-auth-token', JSON.stringify(session)]);
}

export const editorText = (page: Page) => page.evaluate(() => (window as any).editor?.getValue() as string | undefined);

export async function openEditor(page: Page) {
  await page.goto(`/code/${data().projectId}`);
  await page.locator('[data-testid="collab-status"][data-synced="true"]').waitFor({ timeout: 30000 });
}
