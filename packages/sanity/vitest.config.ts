import { defineConfig } from 'vitest/config';

export default defineConfig({
  // Components are rendered in tests; the build uses the automatic runtime too.
  esbuild: { jsx: 'automatic' },
  test: {
    // Every file runs in its own worker either way; a thread starts with
    // less CPU than a forked process, and nothing here needs a process.
    pool: 'threads',
    // Most suites are pure logic. Files that render components or use DOM
    // APIs (the HTML serializers do) opt in with `// @vitest-environment jsdom`.
    environment: 'node',
    setupFiles: ['./src/serialization/__tests__/global.setup.ts'],
    env: {
      // Outside production, styled-components (under Sanity UI) appends each
      // rule to a <style> element as text, and jsdom re-parses the whole
      // sheet every time. This makes it insert rules through the CSSOM, as it
      // does in production, which renders about four times faster.
      SC_DISABLE_SPEEDY: 'false',
    },
  },
});
