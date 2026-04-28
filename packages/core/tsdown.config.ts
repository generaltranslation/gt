import { defineConfig } from 'tsdown';
import { createTsdownConfig } from '../../tsdown.preset.ts';

export default defineConfig(
  createTsdownConfig(
    [
      'src/index.ts',
      'src/runtime.ts',
      'src/id.ts',
      'src/internal.ts',
      'src/errors.ts',
      'src/types.ts',
    ],
    { alwaysBundle: [/^@noble\/hashes/] }
  )
);
