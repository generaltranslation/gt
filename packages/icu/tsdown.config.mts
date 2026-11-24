import { defineConfig } from 'tsdown';
import {
  createTsdownConfig,
  createTsdownUnbundleConfig,
  withPackageChecks,
} from '../../tsdown.preset.mts';

const entries = [
  'src/index.ts',
  'src/parser.ts',
  'src/convert.ts',
  'src/internal.ts',
];

const [cjs] = createTsdownConfig(entries);

// ESM is unbundled so bundlers that skip modules by their imports, such as
// Turbopack, leave out the parser when an app formats no ICU strings.
const esm = createTsdownUnbundleConfig({
  format: 'esm',
  entry: entries,
  clean: false,
  dts: true,
  outExtensions: () => ({ js: '.mjs', dts: '.d.mts' }),
});

export default defineConfig(withPackageChecks([cjs, esm]));
