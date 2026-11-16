import { defineConfig } from '@playwright/test';
import { fileURLToPath } from 'node:url';
import base from '../../playwright.config.js';

export default defineConfig({
  ...base,
  testDir: fileURLToPath(new URL('../../tests/e2e/',import.meta.url)),
  webServer: undefined,
  use: {...base.use,baseURL:'http://127.0.0.1:3201'},
  reporter: [['list'],['html',{open:'never',outputFolder:fileURLToPath(new URL('../../playwright-report/qa-docker/',import.meta.url))}]]
});
