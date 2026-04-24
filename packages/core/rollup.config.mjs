import typescript from '@rollup/plugin-typescript';
import commonjs from '@rollup/plugin-commonjs';
import terser from '@rollup/plugin-terser';
import resolve from '@rollup/plugin-node-resolve';
import { dts } from 'rollup-plugin-dts';

// Pure-ESM deps that we want consumers to bundle/dedupe rather than inlining
// into every one of our entry points. Only externalized in the ESM output —
// in the CJS output we bundle them so that `require('generaltranslation')`
// keeps working on Node <22.12 (where require(ESM) is flag-gated).
const esmOnlyExternal = [/^@noble\/hashes(\/|$)/];

const buildPlugins = () => [
  resolve({ extensions: ['.js', '.mjs', '.ts'] }),
  typescript({ tsconfig: './tsconfig.json' }),
  commonjs(),
  terser(),
];

// Produce both a CJS bundle (with ESM-only deps inlined) and an ESM bundle
// (with ESM-only deps externalized) for a given entry point.
const entry = (input, outBase) => [
  {
    input,
    output: {
      file: `dist/${outBase}.cjs.min.cjs`,
      format: 'cjs',
      exports: 'auto',
      sourcemap: true,
    },
    plugins: buildPlugins(),
  },
  {
    input,
    external: esmOnlyExternal,
    output: {
      file: `dist/${outBase}.esm.min.mjs`,
      format: 'es',
      exports: 'named',
      sourcemap: true,
    },
    plugins: buildPlugins(),
  },
  {
    input,
    output: { file: `dist/${outBase}.d.ts`, format: 'es' },
    plugins: [dts()],
  },
];

export default [
  ...entry('src/index.ts', 'index'),
  ...entry('src/id.ts', 'id'),
  ...entry('src/internal.ts', 'internal'),
  ...entry('src/errors.ts', 'errors'),
  ...entry('src/types.ts', 'types'),
];
