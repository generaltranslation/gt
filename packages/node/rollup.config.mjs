import typescript from '@rollup/plugin-typescript';
import commonjs from '@rollup/plugin-commonjs';
import terser from '@rollup/plugin-terser';
import resolve from '@rollup/plugin-node-resolve';
import { dts } from 'rollup-plugin-dts';

const external = [
  'generaltranslation',
  'gt-i18n/internal',
  'gt-i18n/types',
  'node:async_hooks',
];

export default [
  // Bundling for the main library (index.ts)
  {
    input: 'src/index.ts',
    output: [
      {
        file: 'dist/index.cjs.min.cjs',
        format: 'cjs',
        exports: 'auto',
        sourcemap: true,
      },
      {
        file: 'dist/index.esm.min.mjs',
        format: 'es',
        exports: 'named',
        sourcemap: true,
      },
    ],
    plugins: [
      resolve({ extensions: ['.js', '.mjs', '.ts'] }),
      typescript({ tsconfig: './tsconfig.json', outputToFilesystem: true }),
      commonjs(),
      terser(),
    ],
    external,
  },

  // TypeScript declarations for the main library
  {
    input: 'src/index.ts',
    output: {
      file: 'dist/index.d.ts',
      format: 'es',
    },
    plugins: [dts()],
    external,
  },

  // Bundling for the types library (types.ts)
  {
    input: 'src/types.ts',
    output: [
      {
        file: 'dist/types.cjs.min.cjs',
        format: 'cjs',
        exports: 'auto',
        sourcemap: true,
      },
      {
        file: 'dist/types.esm.min.mjs',
        format: 'es',
        exports: 'named',
        sourcemap: true,
      },
    ],
    plugins: [
      resolve({ extensions: ['.js', '.mjs', '.ts'] }),
      typescript({ tsconfig: './tsconfig.json' }),
      commonjs(),
      terser(),
    ],
    external,
  },

  // TypeScript declarations for the types library
  {
    input: 'src/types.ts',
    output: {
      file: 'dist/types.d.ts',
      format: 'es',
    },
    plugins: [dts()],
    external,
  },

  // Bundling for the internal library (internal.ts)
  {
    input: 'src/internal.ts',
    output: [
      {
        file: 'dist/internal.cjs.min.cjs',
        format: 'cjs',
        exports: 'auto',
        sourcemap: true,
      },
      {
        file: 'dist/internal.esm.min.mjs',
        format: 'es',
        exports: 'named',
        sourcemap: true,
      },
    ],
    plugins: [
      resolve({ extensions: ['.js', '.mjs', '.ts'] }),
      typescript({ tsconfig: './tsconfig.json' }),
      commonjs(),
      terser(),
    ],
    external,
  },

  // TypeScript declarations for the internal library
  {
    input: 'src/internal.ts',
    output: {
      file: 'dist/internal.d.ts',
      format: 'es',
    },
    plugins: [dts()],
    external,
  },
];