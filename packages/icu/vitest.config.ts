import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    // Worker threads start faster than the default forked processes. Files
    // stay isolated, and nothing here needs process-level APIs.
    pool: 'threads',
  },
});
