import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
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
