import { defineConfig } from 'tsdown';
import {
  createTsdownConfig,
  createTsdownUnbundleConfig,
  withPackageChecks,
} from '../../tsdown.preset.mts';

const entries = [
  'src/index.ts',
  'src/internal-compat.ts',
  'src/internal-cookies.ts',
  'src/internal-string.ts',
  'src/internal.ts',
];

const [cjs] = createTsdownConfig(entries);

// ESM is unbundled so bundlers that skip modules by their imports, such as
// Turbopack, leave out what an app never imports (the I18nCache in clients).
const esm = createTsdownUnbundleConfig({
  format: 'esm',
  entry: entries,
  clean: false,
  dts: true,
  outExtensions: () => ({ js: '.mjs', dts: '.d.mts' }),
});

export default defineConfig(withPackageChecks([cjs, esm]));
