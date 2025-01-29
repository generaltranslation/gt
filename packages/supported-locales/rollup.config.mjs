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
    ],
    external: ['generaltranslation']
  },
  
  // TypeScript declarations
  {
    input: 'src/index.ts',
    output: {
      file: 'dist/index.d.ts',
      format: 'es',
    },
    plugins: [dts()],
  }
];
