import { defineConfig } from 'tsdown';
import { createTsdownConfig } from '../../tsdown.preset.mts';

export default defineConfig(
  createTsdownConfig([
    'src/index.ts',
    'src/types.ts',
    'src/fallbacks.ts',
    'src/internal.ts',
    'src/internal-types.ts',
  ])
);
