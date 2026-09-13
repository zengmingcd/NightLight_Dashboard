import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  timeout: 30000,
  workers: 2,
  use: { baseURL: 'http://127.0.0.1:4173', headless: true, viewport: { width: 768, height: 1024 }, hasTouch: true },
  projects: [
    { name: 'chromium', use: { browserName: 'chromium' } },
    { name: 'webkit', use: { browserName: 'webkit' } }
  ],
  webServer: { command: 'npm run serve', url: 'http://127.0.0.1:4173', reuseExistingServer: false }
});
