import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import typescript from '@rollup/plugin-typescript';
import postcss from 'rollup-plugin-postcss';
import peerDepsExternal from 'rollup-plugin-peer-deps-external';
import { babel } from '@rollup/plugin-babel';
import preserveDirectives from 'rollup-preserve-directives';

export default {
  plugins: [
    peerDepsExternal(), // Exclude peer dependencies from the bundle
    resolve({
      // Locates and bundles dependencies in node_modules
      browser: true,
      preferBuiltins: false,
    }),
    commonjs(), // Converts CommonJS modules to ES6
    babel({
      // Transpiles the code using Babel
      babelHelpers: 'bundled',
      exclude: /node_modules/,
      presets: ['@babel/preset-react', '@babel/preset-typescript'],
    }),
    typescript({
      // Compiles TypeScript files
      tsconfig: './tsconfig.json',
      sourceMap: false,
    }),
    postcss(), // Process CSS files
    preserveDirectives(), // Preserve directives in the output (i.e., "use client")
  ],
  external: ['react', 'react-dom', 'generaltranslation', '@generaltranslation/supported-locales'],
};