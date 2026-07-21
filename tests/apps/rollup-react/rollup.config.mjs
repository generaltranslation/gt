import fs from 'node:fs';
import commonjs from '@rollup/plugin-commonjs';
import { rollup as gtCompiler } from '@generaltranslation/compiler';
import json from '@rollup/plugin-json';
import { nodeResolve } from '@rollup/plugin-node-resolve';
import replace from '@rollup/plugin-replace';
import typescript from '@rollup/plugin-typescript';
import postcss from 'rollup-plugin-postcss';

function htmlPlugin() {
  return {
    name: 'html',
    generateBundle() {
      const html = fs
        .readFileSync(new URL('./index.html', import.meta.url), 'utf8')
        .replace('/src/index.ts', '/assets/index.js')
        .replace(
          '</head>',
          '    <link rel="stylesheet" href="/assets/index.css" />\n  </head>'
        );

      this.emitFile({
        type: 'asset',
        fileName: 'index.html',
        source: html,
      });
    },
  };
}

export default {
  input: 'src/index.ts',
  output: {
    dir: 'dist',
    format: 'esm',
    sourcemap: true,
    entryFileNames: 'assets/[name].js',
    chunkFileNames: 'assets/[name]-[hash].js',
    assetFileNames: 'assets/[name][extname]',
  },
  plugins: [
    gtCompiler(),
    replace({
      preventAssignment: true,
      'process.env.NODE_ENV': JSON.stringify(
        process.env.NODE_ENV ?? 'production'
      ),
    }),
    nodeResolve({
      browser: true,
      dedupe: ['react', 'react-dom'],
      extensions: ['.mjs', '.js', '.jsx', '.json', '.ts', '.tsx'],
    }),
    json(),
    commonjs(),
    typescript({
      tsconfig: './tsconfig.json',
      compilerOptions: {
        noEmit: false,
        declaration: false,
        declarationMap: false,
        sourceMap: true,
      },
    }),
    postcss({
      extract: 'assets/index.css',
    }),
    htmlPlugin(),
  ],
};
