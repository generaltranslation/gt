import { defineConfig } from 'tsdown';
import { createTsdownConfig, withPackageChecks } from '../../tsdown.preset.mts';

export default defineConfig(
  withPackageChecks(
    createTsdownConfig([
      'src/index.ts',
      'src/internal-cookies.ts',
      'src/internal-string.ts',
      'src/types.ts',
      'src/internal.ts',
      'src/internal-types.ts',
      'src/unstable.ts',
      'src/unstable-internal.ts',
    ])
  )
);
