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
  ],
  { alwaysBundle: [/^@noble\/hashes/] }
);

// Built on its own so the schema's imports never become chunks shared with,
// and so change, the browser entries.
const configSchemaConfigs = createTsdownConfig(['src/config-schema.ts']).map(
  (config) => ({ ...config, clean: false })
);

export default defineConfig(
  withPackageChecks([
    cjsConfig,
    {
      ...esmConfig,
      copy: [{ from: '../api/spec/openapi.json', to: 'dist' }],
    },
    ...configSchemaConfigs,
  ])
);
