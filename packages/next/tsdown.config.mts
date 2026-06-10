import { defineConfig } from 'tsdown';
import { createTsdownUnbundleConfig } from '../../tsdown.preset.mts';

export default defineConfig(
  createTsdownUnbundleConfig({
    format: 'cjs',
    cjsDefault: false,
    deps: {
      neverBundle: [/^server-only$/],
    },
    useClientBoundary: {
      emittedSourceFiles: 'all',
    },
  })
);
