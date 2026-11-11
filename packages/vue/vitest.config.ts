import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    env: {
      _GT_LOG_LEVEL: 'off',
    },
    // Vue prints this notice once per process on the first client Suspense.
    onConsoleLog: (log) =>
      !log.includes('<Suspense> is an experimental feature'),
  },
});
