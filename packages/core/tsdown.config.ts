import { defineConfig } from 'tsdown';
import { createTsdownConfig } from '../../tsdown.preset.ts';

export default defineConfig(
  [
    ...createTsdownConfig(
      [
        'src/index.ts',
        'src/id.ts',
        'src/internal.ts',
        'src/errors.ts',
        'src/types.ts',
      ],
      { alwaysBundle: [/^@noble\/hashes/] }
    ),
    ...createTsdownConfig(['src/core.ts'], {
      alwaysBundle: [/^@noble\/hashes/],
    }).map((config) => ({
      ...config,
      clean: false,
      outputOptions: (options) => ({
        ...options,
        codeSplitting: false,
      }),
    })),
  ]
);
