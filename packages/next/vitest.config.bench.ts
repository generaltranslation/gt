import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/**/*.bench.ts'],
    benchmark: {
      include: ['src/**/*.bench.ts'],
    },
  },
});
