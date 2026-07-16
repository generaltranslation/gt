import { defineConfig, devices } from '@playwright/test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getApp } from './apps.mjs';

const packageDir = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(packageDir, '../../..');
const appName = process.env.GT_TEST_APP;
const app = getApp(appName);

export default defineConfig({
  expect: { timeout: 15_000 },
  fullyParallel: false,
  outputDir: path.join(
    repositoryRoot,
    '.turbo/playwright/test-results',
    appName ?? 'unknown'
  ),
  projects: [{ name: 'chromium', use: devices['Desktop Chrome'] }],
  reporter: 'line',
  retries: process.env.CI ? 1 : 0,
  testDir: './e2e',
  timeout: 90_000,
  use: {
    baseURL: app.baseURL,
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
  webServer: {
    command: app.command,
    cwd: repositoryRoot,
    reuseExistingServer: false,
    stderr: 'pipe',
    stdout: 'pipe',
    timeout: 180_000,
    url: new URL(app.readyPath, app.baseURL).href,
  },
  workers: 1,
});
