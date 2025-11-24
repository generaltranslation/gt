import typescript from '@rollup/plugin-typescript';
import commonjs from '@rollup/plugin-commonjs';
import terser from '@rollup/plugin-terser';
import resolve from '@rollup/plugin-node-resolve';
import { dts } from 'rollup-plugin-dts';

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
      typescript({ tsconfig: './tsconfig.json' }),
      commonjs(),
      terser(),
    ],
    external: ['generaltranslation', '@generaltranslation/supported-locales'],
  },

  // TypeScript declarations for the main library
  {
    input: 'src/index.ts',
    output: {
      file: 'dist/index.d.ts',
      format: 'es',
    },
    plugins: [dts()],
  },

  // Bundling for the types module
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
      typescript({ tsconfig: './tsconfig.json' }),
      commonjs(),
      terser(),
    ],
    external: ['generaltranslation', '@generaltranslation/supported-locales'],
  },

  // TypeScript declarations for the types module
  {
    input: 'src/types.ts',
    output: {
      file: 'dist/types.d.ts',
      format: 'es',
    },
    plugins: [dts()],
  },

  // Bundling for the fallbacks module
  {
    input: 'src/fallbacks.ts',
    output: [
      {
        file: 'dist/fallbacks.cjs.min.cjs',
        format: 'cjs',
        exports: 'auto',
        sourcemap: true,
      },
      {
        file: 'dist/fallbacks.esm.min.mjs',
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
    external: ['generaltranslation', '@generaltranslation/supported-locales'],
  },

  // TypeScript declarations for the fallbacks module
  {
    input: 'src/fallbacks.ts',
    output: {
      file: 'dist/fallbacks.d.ts',
      format: 'es',
    },
    plugins: [dts()],
  },
];
