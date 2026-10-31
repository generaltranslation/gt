import { defineConfig } from 'tsdown';
import { createTsdownConfig, withPackageChecks } from '../../tsdown.preset.mts';

export default defineConfig(
  withPackageChecks(
    createTsdownConfig({
      index: 'src/index.ts',
      'internal-cookies': 'src/internal-cookies.ts',
      'internal-string': 'src/internal-string.ts',
      types: 'src/types.ts',
      internal: 'src/internal.ts',
      'internal-experimental': 'src/experimental/internal.ts',
      'internal-types': 'src/internal-types.ts',
    })
  )
);
