import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: { baseURL: 'http://127.0.0.1:3100' },
  webServer: {
    command: 'node backend/src/server.js',
    url: 'http://127.0.0.1:3100/api/health',
    // Sin PostgreSQL el servidor devuelve 503: esperar el proceso HTTP, no un 200.
    wait: { stdout: /PNKSecurity escuchando/ },
    reuseExistingServer: false,
    env: {
      APP_ENV: 'qa', NODE_ENV: 'test', PORT: '3100', DB_SSL: 'disable',
      DATABASE_URL: process.env.DATABASE_URL || 'postgresql://unused:unused@127.0.0.1:1/unavailable'
    }
  }
});
