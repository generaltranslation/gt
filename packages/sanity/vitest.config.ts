import { defineConfig, mergeConfig } from 'vitest/config';
import { vitestThreadsPreset } from '../../vitest.preset.mts';

export default mergeConfig(
  vitestThreadsPreset,
  defineConfig({
    // Components are rendered in tests; the build uses the automatic runtime too.
    esbuild: { jsx: 'automatic' },
    test: {
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
  })
);
