import typescript from '@rollup/plugin-typescript';
import commonjs from '@rollup/plugin-commonjs';
import terser from '@rollup/plugin-terser';
import resolve from '@rollup/plugin-node-resolve';
import { dts } from 'rollup-plugin-dts';

const external = [
  'generaltranslation',
  'generaltranslation/types',
  'generaltranslation/internal',
  'generaltranslation/id',
  '@generaltranslation/supported-locales',
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
    external,
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
    external,
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

  // Bundling for the internal module
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

  // TypeScript declarations for the internal module
  {
    input: 'src/internal.ts',
    output: {
      file: 'dist/internal.d.ts',
      format: 'es',
    },
    plugins: [dts()],
  },

  // Bundling for the internal-types module
  {
    input: 'src/internal-types.ts',
    output: [
      {
        file: 'dist/internal-types.cjs.min.cjs',
        format: 'cjs',
        exports: 'auto',
        sourcemap: true,
      },
      {
        file: 'dist/internal-types.esm.min.mjs',
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

  // TypeScript declarations for the internal-types module
  {
    input: 'src/internal-types.ts',
    output: {
      file: 'dist/internal-types.d.ts',
      format: 'es',
    },
    plugins: [dts()],
  },
];
