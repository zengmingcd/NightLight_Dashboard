import { expect, test } from '../../frontend/node_modules/@playwright/test';

test('production dashboard mounts without browser errors in both orientations', async ({ page }, testInfo) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  const statusResponse = page.waitForResponse(response => response.url().endsWith('/api/widgets/status'));
  const response = await page.goto('/');
  expect(response?.status()).toBe(200);
  await expect(page.getByRole('heading', { name: 'NightLight Dashboard' })).toBeVisible();
  const api = await statusResponse;
  expect(api.status()).toBe(200);
  expect(await api.json()).toEqual({ status: 'ok' });
  await expect(page.getByRole('heading', { name: 'Status', exact: true })).toBeVisible();
  await expect(page.getByRole('status')).toHaveText('Application reachable — status: ok');
  await expect(page.getByText('Loading NightLight Dashboard…', { exact: true })).toHaveCount(0);
  await page.screenshot({ path: testInfo.outputPath('portrait.png') });
  await page.setViewportSize({ width: 1024, height: 768 });
  await expect(page.getByRole('main')).toBeVisible();
  await expect(page.getByRole('status')).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('landscape.png') });
  expect(errors).toEqual([]);
});
