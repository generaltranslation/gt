import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['**/__tests__/**/*.test.ts'],
    globals: true,
    // Allow test files to import modules from scripts directory
    alias: {
      '@scripts': './scripts'
    },
  },
});