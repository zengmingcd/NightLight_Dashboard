import { defineConfig } from '@playwright/test';

// Build tests/weather.html into /tmp/nightlight-weather-compat first when set.
const production = process.env.WEATHER_PRODUCTION_TEST === '1';

export default defineConfig({
  testDir: './tests',
  testMatch: 'weather.spec.ts',
  workers: 1,
  use: { baseURL: 'http://127.0.0.1:5175' },
  projects: [
    { name: 'chromium', use: { browserName: 'chromium' } },
    { name: 'webkit', use: { browserName: 'webkit' } }
  ],
  webServer: {
    command: production ?
      'npm exec -- vite preview --host 127.0.0.1 --port 5175 --strictPort --outDir /tmp/nightlight-weather-compat' :
      'npm run dev -- --host 127.0.0.1 --port 5175 --strictPort',
    url: 'http://127.0.0.1:5175/tests/weather.html',
    reuseExistingServer: false
  }
});
