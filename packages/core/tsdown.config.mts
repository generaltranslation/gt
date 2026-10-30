import { defineConfig } from 'tsdown';
import { createTsdownConfig, withPackageChecks } from '../../tsdown.preset.mts';

const [cjsConfig, esmConfig] = createTsdownConfig(
  {
    index: 'src/index.ts',
    api: 'src/api.ts',
    runtime: 'src/runtime.ts',
    id: 'src/id.ts',
    internal: 'src/internal.ts',
    'internal-experimental': 'src/experimental/internal.ts',
    diagnostics: 'src/diagnostics.ts',
    errors: 'src/errors.ts',
    types: 'src/types.ts',
  },
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
