import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['__tests__/**/*.test.ts'],
    // Projects the tests write.
    exclude: ['**/node_modules/**', '**/.tmp/**'],
    // The first test of a file loads its framework's tooling (TypeScript, Vue,
    // Svelte): 5 to 8 seconds in CI, where every package's tests run at once.
    testTimeout: 30_000,
  },
});
