import { defineConfig } from 'tsdown';
import {
  createTsdownConfig,
  createTsdownUnbundleConfig,
} from '../../tsdown.preset.mts';

const entries = [
  'src/index.ts',
  'src/types.ts',
  'src/fallbacks.ts',
  'src/internal.ts',
  'src/internal-types.ts',
];

// CJS consumers (require condition) get the bundled build: esbuild-style
// re-bundling of many small CommonJS modules costs more than one file.
const [cjs] = createTsdownConfig(entries);

// ESM consumers get an unbundled build so bundlers can tree-shake unused
// modules (mirrors @generaltranslation/react-core).
const esm = createTsdownUnbundleConfig({
  format: 'esm',
  entry: entries,
  clean: false,
  outExtensions: () => ({ js: '.mjs', dts: '.d.mts' }),
});

export default defineConfig([cjs, { ...esm, dts: true }]);
