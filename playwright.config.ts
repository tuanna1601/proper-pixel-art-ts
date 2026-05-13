import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests-browser',
  timeout: 120_000,
  use: {
    baseURL: 'http://127.0.0.1:4173',
    headless: true,
  },
  webServer: {
    command: 'node ./scripts/serve.mjs',
    port: 4173,
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
