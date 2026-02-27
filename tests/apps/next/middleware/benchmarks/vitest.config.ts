import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['benchmarks/**/*.bench.ts'],
    benchmark: {
      include: ['benchmarks/**/*.bench.ts'],
    },
  },
});
