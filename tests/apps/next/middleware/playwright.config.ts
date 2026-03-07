import { defineConfig, devices } from '@playwright/test';

const PORT = process.env.CI ? 3456 : 3000;
process.env.PORT = PORT.toString();

export default defineConfig({
  retries: process.env.CI ? 2 : 0,
  testMatch: process.env.TEST_MATCH || 'main.spec.ts',
  testDir: './e2e',
  fullyParallel: true,
  projects: [{ name: 'chromium', use: devices['Desktop Chrome'] }],
  webServer: {
    command: `PORT=${PORT} pnpm start`,
    port: PORT,
    reuseExistingServer: true,
  },
});
