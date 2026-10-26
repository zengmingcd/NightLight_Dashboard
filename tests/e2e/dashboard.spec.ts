import { expect, test, type Page } from '../../frontend/node_modules/@playwright/test';

function forecast() {
  return {
    location: 'Toronto, Ontario, Canada', timezone: 'America/Toronto',
    served_at: '2026-10-23T11:15:00Z', updated_at: '2026-10-23T11:15:00Z',
    updated_label: 'Oct 23, 07:15 EDT', stale_after: '2026-10-23T11:30:00Z',
    stale: false, refresh_error: null,
    hours: Array.from({ length: 24 }, (_, index) => {
      const time = Date.UTC(2026, 9, 23, 11 + index);
      const local = new Date(time - 4 * 3600000).toISOString();
      return {
        time: new Date(time).toISOString(), local_label: local.slice(11, 16),
        local_date: local.slice(0, 10), local_zone: 'EDT',
        temperature_c: 8 + index, precipitation_probability_pct: index * 7 % 101,
        weather_code: 2, is_day: true,
      };
    }),
  };
}

function browserErrors(page: Page, expectedFailures: string[] = []) {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => {
    if (message.type() !== 'error') return;
    const expected = expectedFailures.some(path => message.location().url.endsWith(path)) &&
      /503|Service Unavailable/.test(message.text());
    if (!expected) errors.push(message.text());
  });
  return errors;
}

async function mockWeather(page: Page) {
  await page.route('**/api/widgets/weather', route => route.fulfill({
    status: 200, contentType: 'application/json',
    headers: { 'Cache-Control': 'no-store' }, body: JSON.stringify(forecast()),
  }));
}

async function checkForecast(page: Page) {
  const widget = page.getByRole('region', { name: 'Toronto · Hourly forecast' });
  await expect(widget.locator('.weather-hour')).toHaveCount(12);
  await expect(widget.locator('.weather-hour-label').first()).toHaveText('07:00');
  await expect(widget.locator('.weather-hour-label').last()).toHaveText('18:00');
  await expect(widget.locator('.weather-temperature')).toHaveText(
    Array.from({ length: 12 }, (_, index) => 8 + index + '°C'),
  );
  await expect(widget.locator('.weather-precipitation')).toHaveText(
    Array.from({ length: 12 }, (_, index) => index * 7 % 101 + '%'),
  );
  await expect(widget.getByText('Forecast retrieved')).toContainText('Oct 23, 07:15 EDT');
}

async function checkLayout(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  const cells = await page.locator('.weather-hour').evaluateAll(nodes => nodes.map(node => {
    const bounds = node.getBoundingClientRect();
    return { top: bounds.top, left: bounds.left, right: bounds.right };
  }));
  expect(cells.slice(0, 6).every(cell => cell.top === cells[0].top)).toBe(true);
  expect(cells.slice(6).every(cell => cell.top === cells[6].top)).toBe(true);
  expect(cells[6].top).toBeGreaterThan(cells[0].top);
  expect(await page.locator('.weather-hour').evaluateAll(nodes => nodes.every(node =>
    node.scrollWidth <= node.clientWidth,
  ))).toBe(true);
}

test('production dashboard serves both widgets and preserves the forecast in both orientations', async ({ page }, testInfo) => {
  const errors = browserErrors(page);
  await mockWeather(page);
  const statusResponse = page.waitForResponse(response => response.url().endsWith('/api/widgets/status'));
  const response = await page.goto('/');
  expect(response?.status()).toBe(200);
  await expect(page.getByRole('heading', { name: 'NightLight Dashboard' })).toBeVisible();
  const api = await statusResponse;
  expect(api.status()).toBe(200);
  expect(await api.json()).toEqual({ status: 'ok' });
  const status = page.getByRole('region', { name: 'Status', exact: true });
  await expect(status.getByRole('status')).toHaveText('Application reachable — status: ok');
  await checkForecast(page);
  await expect(page.getByText('Loading NightLight Dashboard…', { exact: true })).toHaveCount(0);
  for (const [width, height] of [[768, 1024], [1024, 768]]) {
    await page.setViewportSize({ width, height });
    await checkLayout(page);
    const weatherBounds = await page.locator('.weather-widget').boundingBox();
    const statusBounds = await status.boundingBox();
    expect(weatherBounds).not.toBeNull();
    expect(statusBounds).not.toBeNull();
    expect(weatherBounds!.width).toBeGreaterThanOrEqual(statusBounds!.width);
    if (width === 1024) {
      expect(statusBounds!.x).toBeGreaterThan(weatherBounds!.x);
      expect(Math.max(weatherBounds!.y + weatherBounds!.height, statusBounds!.y + statusBounds!.height)).toBeLessThanOrEqual(height);
    } else {
      expect(statusBounds!.y).toBeGreaterThan(weatherBounds!.y + weatherBounds!.height);
    }
    await page.screenshot({ path: testInfo.outputPath('dashboard-' + width + '.png') });
  }
  expect(errors).toEqual([]);
});

test('Status can finish while the Weather response remains pending', async ({ page }) => {
  const errors = browserErrors(page);
  let release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  await page.route('**/api/widgets/weather', async route => {
    await gate;
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(forecast()) });
  });
  try {
    await page.goto('/');
    await expect(page.locator('.status-widget').getByRole('status')).toHaveText('Application reachable — status: ok');
    await expect(page.locator('.weather-widget').getByRole('status')).toHaveText('Loading hourly forecast…');
  } finally { release(); }
  await checkForecast(page);
  expect(errors).toEqual([]);
});

test('Weather can finish while the Status response remains pending', async ({ page }) => {
  const errors = browserErrors(page);
  await mockWeather(page);
  let release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  await page.route('**/api/widgets/status', async route => {
    await gate;
    await route.continue();
  });
  try {
    await page.goto('/');
    await checkForecast(page);
    await expect(page.locator('.status-widget').getByRole('status')).toHaveText('Checking application status…');
  } finally { release(); }
  await expect(page.locator('.status-widget').getByRole('status')).toHaveText('Application reachable — status: ok');
  expect(errors).toEqual([]);
});

test('Weather failure leaves the real Status endpoint working', async ({ page }) => {
  const errors = browserErrors(page, ['/api/widgets/weather']);
  await page.route('**/api/widgets/weather', route => route.fulfill({
    status: 503, contentType: 'application/json', body: JSON.stringify({ error: { code: 'weather_unavailable' } }),
  }));
  await page.goto('/');
  await expect(page.locator('.weather-widget').getByRole('status')).toContainText('HTTP 503');
  await expect(page.locator('.status-widget').getByRole('status')).toHaveText('Application reachable — status: ok');
  await checkLayout(page);
  expect(errors).toEqual([]);
});

test('Status failure leaves the Weather forecast working', async ({ page }) => {
  const errors = browserErrors(page, ['/api/widgets/status']);
  await mockWeather(page);
  await page.route('**/api/widgets/status', route => route.fulfill({
    status: 503, contentType: 'application/json', body: '{}',
  }));
  await page.goto('/');
  await expect(page.locator('.status-widget').getByRole('status')).toContainText('HTTP 503');
  await expect(page.locator('.status-widget').getByRole('button', { name: 'Retry' })).toBeEnabled();
  await checkForecast(page);
  await checkLayout(page);
  expect(errors).toEqual([]);
});

test('production static assets and unknown routes preserve their contracts', async ({ request }) => {
  const dashboard = await request.get('/');
  expect(dashboard.status()).toBe(200);
  expect(dashboard.headers()['cache-control']).toBe('no-cache');
  const html = await dashboard.text();
  const assets = Array.from(html.matchAll(/(?:src|href)="(\/assets\/[^\"]+)"/g), match => match[1]);
  expect(assets.some(path => path.endsWith('.js'))).toBe(true);
  expect(assets.some(path => path.endsWith('.css'))).toBe(true);
  for (const path of assets) {
    const asset = await request.get(path);
    expect(asset.status()).toBe(200);
    expect(asset.headers()['content-type']).toContain(path.endsWith('.js') ? 'javascript' : 'text/css');
  }
  for (const path of ['/api', '/api/missing', '/api/widgets/missing', '/missing', '/assets/missing.js']) {
    const response = await request.get(path);
    expect(response.status()).toBe(404);
    expect(response.headers()['content-type']).toContain('application/json');
    expect(await response.json()).toEqual({ detail: 'Not Found' });
  }
});
