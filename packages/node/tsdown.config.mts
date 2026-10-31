import { defineConfig } from 'tsdown';
import { createTsdownConfig, withPackageChecks } from '../../tsdown.preset.mts';

export default defineConfig(
  withPackageChecks(
    createTsdownConfig([
      'src/index.ts',
      'src/types.ts',
      'src/internal.ts',
      'src/unstable.ts',
      'src/unstable-icu.ts',
    ])
  )
);
