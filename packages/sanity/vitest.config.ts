import { defineConfig } from 'vitest/config';

export default defineConfig({
  // Components are rendered in tests; the build uses the automatic runtime too.
  esbuild: { jsx: 'automatic' },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/serialization/__tests__/global.setup.ts'],
  },
});
