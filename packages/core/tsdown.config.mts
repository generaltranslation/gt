import { defineConfig } from 'tsdown';
import {
  createTsdownConfig,
  createTsdownUnbundleConfig,
  withPackageChecks,
} from '../../tsdown.preset.mts';

const entries = [
  'src/index.ts',
  'src/api.ts',
  'src/runtime.ts',
  'src/id.ts',
  'src/internal.ts',
  'src/diagnostics.ts',
];

// CommonJS bundles @noble/hashes, which publishes only ESM.
const [cjsConfig] = createTsdownConfig(entries, {
  alwaysBundle: [/^@noble\/hashes/],
});

// ESM is unbundled so bundlers that skip modules by their imports, such as
// Turbopack, leave out what an app never imports (the ICU message formatter
// and the API client).
const esmConfig = createTsdownUnbundleConfig({
  format: 'esm',
  entry: entries,
  clean: false,
  dts: true,
  outExtensions: () => ({ js: '.mjs', dts: '.d.mts' }),
  copy: [{ from: '../api/spec/openapi.json', to: 'dist' }],
});

// Built on its own so the schema's imports never become chunks shared with,
// and so change, the browser entries.
const configSchemaConfigs = createTsdownConfig(['src/config-schema.ts']).map(
  (config) => ({ ...config, clean: false })
);

export default defineConfig(
  withPackageChecks([cjsConfig, esmConfig, ...configSchemaConfigs])
);
