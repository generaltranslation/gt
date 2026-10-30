import { defineConfig } from 'tsdown';
import { createTsdownConfig, withPackageChecks } from '../../tsdown.preset.mts';

const [cjsConfig, esmConfig] = createTsdownConfig(
  [
    'src/index.ts',
    'src/api.ts',
    'src/runtime.ts',
    'src/id.ts',
    'src/internal.ts',
    'src/diagnostics.ts',
    'src/types.ts',
  ],
  { alwaysBundle: [/^@noble\/hashes/] }
);

export default defineConfig(
  withPackageChecks([
    cjsConfig,
    {
      ...esmConfig,
      copy: [{ from: '../api/spec/openapi.json', to: 'dist' }],
    },
  ])
);
