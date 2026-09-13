import { test, expect, type Page } from '@playwright/test';

async function counters(page: Page) {
  return JSON.parse(await page.getByTestId('diagnostics').innerText());
}
test.beforeEach(async ({ page }) => {
  await page.goto('/?fast=1');
  await expect(page.getByTestId('probe')).toBeVisible();
  await expect(page.getByText('Loading compatibility spike… If this remains visible, the JavaScript did not mount.')).toHaveCount(0);
});
test.afterEach(async ({ page }) => {
  await expect.poll(async () => (await counters(page)).errors).toBe(0);
});

test('state, events, CSS and mount cleanup', async ({ page }, testInfo) => {
  await page.getByRole('button', { name: 'Increment', exact: true }).click();
  await expect(page.getByTestId('count')).toHaveText('1');
  await page.getByRole('button', { name: 'Send event' }).click();
  await expect(page.getByTestId('events')).toHaveText('1');
  await expect.poll(async () => Number(await page.getByTestId('ticks').innerText())).toBeGreaterThan(1);
  await expect(page.locator('.grid')).toHaveCSS('display', 'grid');
  await expect(page.locator('.controls')).toHaveCSS('display', 'flex');
  await page.getByRole('button', { name: 'Change accent' }).click();
  await expect(page.getByRole('button', { name: 'Change accent' })).toHaveCSS('background-color', 'rgb(255, 210, 139)');
  await page.screenshot({ path: testInfo.outputPath('portrait.png'), fullPage: true });
  await page.setViewportSize({ width: 1024, height: 768 });
  await page.screenshot({ path: testInfo.outputPath('landscape.png'), fullPage: true });
  await page.getByRole('button', { name: 'Unmount', exact: true }).click();
  await expect.poll(async () => (await counters(page)).componentTimers).toBe(0);
  await expect.poll(async () => (await counters(page)).componentListeners).toBe(0);
  const before = await counters(page);
  await page.getByRole('button', { name: 'Send event' }).click();
  await page.waitForTimeout(700);
  const after = await counters(page);
  expect(after.events).toBe(before.events);
  expect(after.ticks).toBe(before.ticks);
  await page.getByRole('button', { name: 'Mount', exact: true }).click();
  await expect(page.getByTestId('count')).toHaveText('0');
  await page.getByRole('button', { name: 'Send event' }).click();
  await expect(page.getByTestId('events')).toHaveText('1');
});

test('loading, failure retains data, recovery', async ({ page }) => {
  await expect(page.getByTestId('value')).not.toHaveText('No data yet');
  await page.getByLabel('Response').selectOption('delay');
  await expect(page.getByRole('status')).toHaveText('Loading');
  await expect(page.getByRole('status')).toHaveText('Success');
  await page.getByLabel('Response').selectOption('fail');
  await expect(page.getByRole('status')).toContainText('HTTP 503');
  await expect(page.getByTestId('value')).not.toHaveText('No data yet');
  await page.getByLabel('Response').selectOption('ok');
  await expect.poll(async () => (await counters(page)).successes).toBeGreaterThan(1);
});

test('timeout settles through native cancellation and recovers', async ({ page }) => {
  await page.getByLabel('Response').selectOption('slow');
  await expect(page.getByRole('status')).toContainText('timeout');
  await expect.poll(async () => (await counters(page)).abortRejections).toBeGreaterThan(0);
  await page.getByLabel('Response').selectOption('ok');
  await expect(page.getByRole('status')).toHaveText('Success');
  expect((await counters(page)).maxOutstanding).toBe(1);
});

test('actual browser network failure recovers without reload', async ({ page, context }) => {
  const session = await page.getByTestId('session').innerText();
  await context.setOffline(true);
  await page.getByRole('button', { name: 'Retry now' }).click();
  await expect(page.getByRole('status')).toContainText('Error:');
  const successes = (await counters(page)).successes;
  await context.setOffline(false);
  await expect.poll(async () => (await counters(page)).successes).toBeGreaterThan(successes);
  await expect(page.getByTestId('session')).toHaveText(session);
});

test('late responses are ignored even when AbortController is unavailable', async ({ page }) => {
  await page.addInitScript(() => { Object.defineProperty(window, 'AbortController', { value: undefined }); });
  await page.reload();
  await page.getByLabel('Response').selectOption('delay');
  await expect(page.getByRole('status')).toHaveText('Loading');
  await page.getByRole('button', { name: 'Unmount', exact: true }).click();
  await expect.poll(async () => (await counters(page)).outstanding).toBe(0);
  await expect.poll(async () => (await counters(page)).lateResponses).toBeGreaterThan(0);
  await expect.poll(async () => (await counters(page)).componentTimers).toBe(0);
  await page.getByRole('button', { name: 'Mount', exact: true }).click();
  await expect(page.getByRole('status')).toHaveText('Success');
  expect((await counters(page)).maxOutstanding).toBe(1);
});

test('pagehide/pageshow handler logic stops and resumes without duplication', async ({ page }) => {
  await page.evaluate(() => window.dispatchEvent(new Event('pagehide')));
  await expect.poll(async () => (await counters(page)).componentTimers).toBe(0);
  const before = (await counters(page)).ticks;
  await page.waitForTimeout(700);
  expect((await counters(page)).ticks).toBe(before);
  await page.evaluate(() => {
    window.dispatchEvent(new Event('pageshow'));
    window.dispatchEvent(new Event('pageshow'));
  });
  await expect.poll(async () => (await counters(page)).ticks).toBeGreaterThan(before);
  expect((await counters(page)).componentTimers).toBeLessThanOrEqual(2);
  expect((await counters(page)).componentListeners).toBe(7);
  // Handler test only: a property override does not reproduce OS suspension.
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, value: true });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await expect.poll(async () => (await counters(page)).componentTimers).toBe(0);
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, value: false });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await expect.poll(async () => (await counters(page)).componentTimers).toBeGreaterThan(0);
});

test('ineffective abort keeps requests bounded and ignores timed-out results', async ({ page }) => {
  await page.addInitScript(() => {
    const NativeController = window.AbortController;
    window.AbortController = class extends NativeController { abort() {} };
  });
  await page.reload();
  await page.getByLabel('Response').selectOption('slow');
  await expect(page.getByRole('status')).toContainText('awaiting request settlement');
  await page.waitForTimeout(600);
  expect((await counters(page)).outstanding).toBe(1);
  await expect.poll(async () => (await counters(page)).lateResponses, { timeout: 6000 }).toBeGreaterThan(0);
  await page.getByLabel('Response').selectOption('ok');
  await expect(page.getByRole('status')).toHaveText('Success', { timeout: 7000 });
  expect((await counters(page)).maxOutstanding).toBe(1);
});

test('accelerated cycles keep diagnostics, DOM and work bounded', async ({ page }) => {
  test.setTimeout(45000);
  await page.getByRole('button', { name: 'Start cycles' }).click();
  await expect.poll(async () => (await counters(page)).mounts, { timeout: 30000 }).toBeGreaterThanOrEqual(25);
  await page.getByRole('button', { name: 'Stop cycles' }).click();
  if (await page.getByRole('button', { name: 'Mount', exact: true }).count()) {
    await page.getByRole('button', { name: 'Mount', exact: true }).click();
  }
  await expect.poll(async () => (await counters(page)).componentListeners).toBe(7);
  expect((await counters(page)).maxOutstanding).toBe(1);
  expect((await counters(page)).componentTimers).toBeLessThanOrEqual(2);
  expect(await page.locator('ol li').count()).toBeLessThanOrEqual(30);
  const nodes = await page.locator('*').count();
  const ticks = (await counters(page)).ticks;
  await page.waitForTimeout(2200);
  const delta = (await counters(page)).ticks - ticks;
  expect(delta).toBeGreaterThan(5);
  expect(delta).toBeLessThan(32);
  expect(await page.locator('*').count()).toBeLessThanOrEqual(nodes + 2);
  await page.getByRole('button', { name: 'Increment', exact: true }).click();
  await expect(page.getByTestId('count')).toHaveText('1');
});
