import typescript from '@rollup/plugin-typescript';
import commonjs from '@rollup/plugin-commonjs';
import resolve from '@rollup/plugin-node-resolve';
import {
  createDtsConfig,
  createMinifiedBundleConfig,
} from '../../rollup.preset.mjs';

const external = [
  'react',
  'react-dom',
  'generaltranslation',
  'generaltranslation/core',
  'generaltranslation/types',
  'generaltranslation/internal',
  'generaltranslation/id',
  'gt-react',
  'gt-react/internal',
  'gt-react/client',
  'gt-i18n',
  'gt-i18n/types',
  'gt-i18n/internal',
  '@generaltranslation/react-core',
  '@generaltranslation/react-core/internal',
  '@generaltranslation/react-core/types',
  '@generaltranslation/react-core/errors',
  '@tanstack/react-start',
  '@tanstack/react-start/server',
];

export default [
  createMinifiedBundleConfig({
    input: 'src/index.ts',
    outputName: 'index',
    distDir: 'dist',
    esmFormat: 'es',
    plugins: [
      resolve({ extensions: ['.js', '.mjs', '.ts', '.tsx'] }),
      typescript({ tsconfig: './tsconfig.json', outputToFilesystem: true }),
      commonjs(),
    ],
    external,
  }),
  createDtsConfig({
    input: 'src/index.ts',
    outputName: 'index',
    distDir: 'dist',
    format: 'es',
  }),
  createDtsConfig({
    input: 'src/types.ts',
    outputName: 'types',
    distDir: 'dist',
    format: 'es',
  }),
];
