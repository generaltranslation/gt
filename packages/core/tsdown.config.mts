import { defineConfig } from 'tsdown';
import { createTsdownConfig } from '../../tsdown.preset.mts';

const [cjsConfig, esmConfig] = createTsdownConfig(
  [
    'src/index.ts',
    'src/api.ts',
    'src/runtime.ts',
    'src/id.ts',
    'src/internal.ts',
    'src/errors.ts',
    'src/types.ts',
  ],
  { alwaysBundle: [/^@noble\/hashes/] }
);

export default defineConfig([
  cjsConfig,
  {
    ...esmConfig,
    copy: [{ from: '../api/spec/openapi.json', to: 'dist' }],
  },
]);
