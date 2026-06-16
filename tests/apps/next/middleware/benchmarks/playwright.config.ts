import { defineConfig, devices } from '@playwright/test';

const PORT = process.env.CI ? 3456 : 3000;
process.env.PORT = PORT.toString();

export default defineConfig({
  testDir: '.',
  testMatch: 'e2e-performance.spec.ts',
  fullyParallel: false,
  timeout: 30_000,
  projects: [{ name: 'chromium', use: devices['Desktop Chrome'] }],
  webServer: {
    command: `PORT=${PORT} pnpm start`,
    port: PORT,
    reuseExistingServer: true,
    timeout: 15_000,
  },
});
