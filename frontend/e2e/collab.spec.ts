import { test, expect, Browser } from '@playwright/test';
import { signIn, openEditor, editorText } from './session';

async function twoUsers(browser: Browser) {
  const ctxA = await browser.newContext();
  const ctxB = await browser.newContext();
  await signIn(ctxA, 'alice');
  await signIn(ctxB, 'bob');
  const a = await ctxA.newPage();
  const b = await ctxB.newPage();
  await openEditor(a);
  await openEditor(b);
  return { a, b, close: async () => { await ctxA.close(); await ctxB.close(); } };
}

test('two browsers edit the same file and converge through Yjs', async ({ browser }) => {
  const { a, b, close } = await twoUsers(browser);
  await expect.poll(() => editorText(a)).toContain('print("seed")');
  await expect.poll(() => editorText(b)).toContain('print("seed")');

  await a.locator('.monaco-editor').first().click();
  await a.keyboard.press('ControlOrMeta+End');
  await a.keyboard.type('\nprint("from alice")');
  await expect.poll(() => editorText(b), { timeout: 10000 }).toContain('print("from alice")');

  await b.locator('.monaco-editor').first().click();
  await b.keyboard.press('ControlOrMeta+End');
  await b.keyboard.type('\nprint("from bob")');
  await expect.poll(() => editorText(a), { timeout: 10000 }).toContain('print("from bob")');

  await expect.poll(async () => (await editorText(a)) === (await editorText(b))).toBe(true);
  await close();
});

test('snapshot + restore updates both open editors', async ({ browser }) => {
  const { a, b, close } = await twoUsers(browser);
  a.on('dialog', d => d.accept());
  await a.getByTestId('versions-tab').click();
  const snapshotText = await editorText(a);
  await a.getByTestId('save-snapshot').click();
  const restoreBtn = a.locator('[data-testid^="restore-v"]').first();
  await restoreBtn.waitFor();
  const versionTestId = await restoreBtn.getAttribute('data-testid');

  await a.locator('.monaco-editor').first().click();
  await a.keyboard.press('ControlOrMeta+End');
  await a.keyboard.type('\n# change to be undone');
  await expect.poll(() => editorText(b)).toContain('# change to be undone');

  await a.getByTestId(versionTestId!).click();
  await expect.poll(() => editorText(a), { timeout: 10000 }).toBe(snapshotText);
  await expect.poll(() => editorText(b), { timeout: 10000 }).toBe(snapshotText);
  await close();
});

test('Run executes through API -> BullMQ -> worker -> (fake) Judge0 and shows output', async ({ browser }) => {
  const ctx = await browser.newContext();
  await signIn(ctx, 'alice');
  const page = await ctx.newPage();
  await openEditor(page);
  await page.getByRole('button', { name: /^Run$/ }).click();
  await expect(page.getByText(/ran \d+ bytes/).first()).toBeVisible({ timeout: 20000 });
  await ctx.close();
});
