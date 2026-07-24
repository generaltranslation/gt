import { defineConfig } from 'tsdown';
import { createTsdownUnbundleConfig } from '../../tsdown.preset.mts';

export default defineConfig({
  ...createTsdownUnbundleConfig({
    format: 'esm',
  }),
  // The migrate engine ships as a separate, on-demand package. Keep it external
  // so it is never bundled into the CLI dist: the whole point of the split is
  // that most users never fetch it. The CLI loads it at runtime via a dynamic
  // import (see cli/commands/migrateEngineLoader.ts).
  external: ['@generaltranslation/migrate'],
});
