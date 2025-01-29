import typescript from '@rollup/plugin-typescript';
import commonjs from '@rollup/plugin-commonjs';
import terser from "@rollup/plugin-terser";
import { dts } from "rollup-plugin-dts";

export default [
  // Bundling for the main library (index.ts)
  {
    input: 'src/index.ts',
    output: [
      {
        file: 'dist/index.cjs.min.cjs',
        format: 'cjs',
        exports: 'auto', // 'auto' ensures compatibility with both default and named exports in CommonJS
        sourcemap: true,
      },
      {
        file: 'dist/index.esm.min.mjs',
        format: 'es',
        exports: 'named', // Named exports for ES modules
        sourcemap: true,
      },
    ],
    plugins: [
      typescript({ tsconfig: './tsconfig.json' }),
      commonjs(), // Handle CommonJS dependencies
      terser(), // Minification
    ]
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

  // Bundling for the id module (id.ts)
  {
    input: 'src/id.ts',
    output: [
      {
        file: 'dist/id.cjs.min.cjs',
        format: 'cjs',
        exports: 'auto',
        sourcemap: true,
      },
      {
        file: 'dist/id.esm.min.mjs',
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
    external: ['xxhashjs'] // External dependencies not bundled in
  },

  // TypeScript declarations for the id module
  {
    input: 'src/id.ts',
    output: {
      file: 'dist/id.d.ts',
      format: 'es',
    },
    plugins: [
      dts()
    ]
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
      typescript({ tsconfig: './tsconfig.json' }),
      commonjs(),
      terser(),
    ]
  },

  // TypeScript declarations for the internal module
  {
    input: 'src/internal.ts',
    output: {
      file: 'dist/internal.d.ts',
      format: 'es',
    },
    plugins: [
      dts()
    ]
  },
];
