import baseConfig from './rollup.base.config.mjs';
import terser from '@rollup/plugin-terser';
import { dts } from 'rollup-plugin-dts';

export default [
  /* ---------------------------------------- */
  // Bundling for the main library (index.ts)
  {
    input: './src/index.ts',
    output: [
      {
        file: './dist/index.cjs.min.cjs',
        format: 'cjs',
        exports: 'auto', // 'auto' ensures compatibility with both default and named exports in CommonJS
        sourcemap: true,
      },
      {
        file: './dist/index.esm.min.mjs',
        format: 'esm',
        exports: 'named', // Named exports for ES modules
        sourcemap: true,
      },
    ],
    plugins: [
      ...baseConfig.plugins,
      terser(), // Minification
    ],
    external: baseConfig.external,
  },

  // TypeScript declarations for the main library (index.ts)
  {
    input: './src/index.ts',
    output: {
      file: './dist/index.d.ts',
      format: 'esm',
    },
    plugins: [dts()],
  },

  /* ---------------------------------------- */
  // Bundling for the internal library (internal.ts)
  {
    input: './src/internal.ts',
    output: [
      {
        file: './dist/internal.cjs.min.cjs',
        format: 'cjs',
        exports: 'auto', // 'auto' ensures compatibility with both default and named exports in CommonJS
        sourcemap: true,
      },
      {
        file: './dist/internal.esm.min.mjs',
        format: 'esm',
        exports: 'named', // Named exports for ES modules
        sourcemap: true,
      },
    ],
    plugins: [
      ...baseConfig.plugins,
      terser(), // Minification
    ],
    external: baseConfig.external,
  },

  // TypeScript declarations for the internal library (internal.ts)
  {
    input: './src/internal.ts',
    output: {
      file: './dist/internal.d.ts',
      format: 'esm',
    },
    plugins: [dts()],
  },

  /* ---------------------------------------- */
  // Bundling for the errors library (errors.ts)
  {
    input: './src/errors.ts',
    output: [
      {
        file: './dist/errors.cjs.min.cjs',
        format: 'cjs',
        exports: 'auto', // 'auto' ensures compatibility with both default and named exports in CommonJS
        sourcemap: true,
      },
      {
        file: './dist/errors.esm.min.mjs',
        format: 'esm',
        exports: 'named', // Named exports for ES modules
        sourcemap: true,
      },
    ],
    plugins: [
      ...baseConfig.plugins,
      terser(), // Minification
    ],
    external: baseConfig.external,
  },

  // TypeScript declarations for the errors library (errors.ts)
  {
    input: './src/errors.ts',
    output: {
      file: './dist/errors.d.ts',
      format: 'esm',
    },
    plugins: [dts()],
  },

  /* ---------------------------------------- */
  // TypeScript declarations for the internal library (internal.ts)
  {
    input: './src/types.ts',
    output: {
      file: './dist/types.d.ts',
      format: 'esm',
    },
    plugins: [dts()],
  },
];
