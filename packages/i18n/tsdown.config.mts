import { defineConfig } from 'tsdown';
import { createTsdownConfig } from '../../tsdown.preset.mts';

const standard = createTsdownConfig([
  'src/index.ts',
  'src/internal-cookies.ts',
  'src/internal-string.ts',
  'src/types.ts',
  'src/internal.ts',
  'src/internal-types.ts',
]);
const production = createTsdownConfig(['src/internal-static.ts']).map(
  (config) => ({
    ...config,
    clean: false,
    define: { 'process.env.NODE_ENV': JSON.stringify('production') },
    dts: false,
    treeshake: { moduleSideEffects: false },
  })
);

export default defineConfig([...standard, ...production]);
