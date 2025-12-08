import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
    testTimeout: 15000,
    isolate: true,
    reporters: [
      [
        'default',
        {
          summary: true,
        },
      ],
    ],
  },
});
