import baseConfig from './rollup.base.config.js';
import terser from "@rollup/plugin-terser";
import { dts } from "rollup-plugin-dts";


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
    external: baseConfig.external
  },
  
  // TypeScript declarations for the main library (index.ts)
  {
    input: './src/index.ts',
    output: {
      file: './dist/index.d.ts',
      format: 'es',
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
    external: baseConfig.external
  },
  
  // TypeScript declarations for the internal library (internal.ts)
  {
    input: './src/internal.ts',
    output: {
      file: './dist/internal.d.ts',
      format: 'es',
    },
    plugins: [dts()],
  },

  /* ---------------------------------------- */
  // Bundling for the client library (client.ts)
  {
    input: 'src/client.ts',
    output: [
      {
        file: './dist/client.cjs.min.cjs',
        format: 'cjs',
        exports: 'auto', // 'auto' ensures compatibility with both default and named exports in CommonJS
        sourcemap: true,
      },
      {
        file: './dist/client.esm.min.mjs',
        format: 'esm',
        exports: 'named', // Named exports for ES modules
        sourcemap: true,
      },
    ],
    plugins: [
      ...baseConfig.plugins,
      terser(), // Minification
    ],
    external: baseConfig.external
  },
  
  // TypeScript declarations for the client library (client.ts)
  {
    input: './src/client.ts',
    output: {
      file: './dist/client.d.ts',
      format: 'es',
    },
    plugins: [dts()],
  },
];
