import { defineConfig } from '@playwright/test';

const externalURL = process.env.DASHBOARD_URL;

export default defineConfig({
  testDir: '../tests/e2e',
  workers: 1,
  use: {
    baseURL: externalURL || 'http://127.0.0.1:8000',
    viewport: { width: 768, height: 1024 },
    hasTouch: true
  },
  projects: [
    { name: 'chromium', use: { browserName: 'chromium' } },
    { name: 'webkit', use: { browserName: 'webkit' } }
  ],
  webServer: externalURL ? undefined : {
    command: '../.venv/bin/python -m uvicorn nightlight.main:app --app-dir ../backend --host 127.0.0.1 --port 8000',
    url: 'http://127.0.0.1:8000',
    reuseExistingServer: false
  }
});
