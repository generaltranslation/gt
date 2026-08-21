import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    env: {
      _GT_LOG_LEVEL: 'off',
    },
  },
});
