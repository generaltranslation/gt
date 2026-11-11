import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['__tests__/**/*.test.ts'],
    // Projects the plugin tests write.
    exclude: ['**/node_modules/**', '**/.tmp/**'],
  },
});
