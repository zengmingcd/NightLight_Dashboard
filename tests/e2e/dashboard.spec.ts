import { expect, test } from '../../frontend/node_modules/@playwright/test';

test('production dashboard mounts without browser errors in both orientations', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  const response = await page.goto('/');
  expect(response?.status()).toBe(200);
  await expect(page.getByRole('heading', { name: 'NightLight Dashboard' })).toBeVisible();
  await expect(page.getByText('The dashboard is ready.', { exact: true })).toBeVisible();
  await expect(page.getByText('Loading NightLight Dashboard…', { exact: true })).toHaveCount(0);
  await page.setViewportSize({ width: 1024, height: 768 });
  await expect(page.getByRole('main')).toBeVisible();
  expect(errors).toEqual([]);
});
