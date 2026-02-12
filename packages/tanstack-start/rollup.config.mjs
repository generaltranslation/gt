import typescript from '@rollup/plugin-typescript';
import commonjs from '@rollup/plugin-commonjs';
import terser from '@rollup/plugin-terser';
import resolve from '@rollup/plugin-node-resolve';
import { dts } from 'rollup-plugin-dts';

const external = [
  'react',
  'react-dom',
  'generaltranslation',
  'generaltranslation/types',
  'generaltranslation/internal',
  'generaltranslation/id',
  'gt-react',
  'gt-react/internal',
  'gt-react/client',
  'gt-i18n',
  'gt-i18n/types',
  'gt-i18n/internal',
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
      resolve({ extensions: ['.js', '.mjs', '.ts', '.tsx'] }),
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
];
