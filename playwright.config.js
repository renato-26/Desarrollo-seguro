import { defineConfig } from '@playwright/test';

const port = Number(process.env.E2E_PORT || 3401);
if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error('E2E_PORT inválido');
const base = `http://127.0.0.1:${port}`;

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: { baseURL: base },
  webServer: {
    command: 'node backend/src/server.js',
    url: `${base}/api/health`,
    wait: { stdout: /PNKSecurity escuchando/ },
    reuseExistingServer: false,
    env: {
      APP_ENV: 'qa', NODE_ENV: 'test', PORT: String(port), DB_SSL: 'disable',
      DATABASE_URL: process.env.DATABASE_URL || 'postgresql://unused:unused@127.0.0.1:1/unavailable'
    }
  }
});
