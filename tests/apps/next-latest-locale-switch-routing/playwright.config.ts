import { defineConfig, devices } from '@playwright/test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const packageDir = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(packageDir, '../../..');
const prefixDefaultLocale = process.env.GT_PREFIX_DEFAULT_LOCALE === 'true';
const configuration = `routing-prefix-default-${prefixDefaultLocale}`;

export default defineConfig({
  expect: { timeout: 15_000 },
  fullyParallel: false,
  outputDir: path.join(
    repositoryRoot,
    '.turbo/playwright/next-latest-locale-switch',
    configuration
  ),
  projects: [{ name: 'chromium', use: devices['Desktop Chrome'] }],
  reporter: 'line',
  retries: process.env.CI ? 1 : 0,
  testDir: './e2e',
  timeout: 90_000,
  use: {
    baseURL: 'http://127.0.0.1:3010',
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
  webServer: {
    command: 'pnpm start --port 3010',
    cwd: packageDir,
    reuseExistingServer: false,
    stderr: 'pipe',
    stdout: 'pipe',
    timeout: 180_000,
    url: 'http://127.0.0.1:3010/',
  },
  workers: 1,
});
