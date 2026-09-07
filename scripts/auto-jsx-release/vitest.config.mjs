import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['scripts/auto-jsx-release/*.test.mjs'],
    environment: 'node',
  },
});
