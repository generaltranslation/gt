import { defineConfig } from 'vitest/config';

// Kept separate from vite.config.ts so the tests do not run the app's plugins.
export default defineConfig({
  test: {
    include: ['__tests__/**/*.test.ts'],
    environment: 'node',
  },
});
