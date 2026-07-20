import 'dotenv/config';
import fs from 'node:fs';
import commonjs from '@rollup/plugin-commonjs';
import { rollup as gtCompiler } from '@generaltranslation/compiler';
import json from '@rollup/plugin-json';
import { nodeResolve } from '@rollup/plugin-node-resolve';
import replace from '@rollup/plugin-replace';
import typescript from '@rollup/plugin-typescript';
import postcss from 'rollup-plugin-postcss';
import serve from 'rollup-plugin-serve';
import livereload from 'rollup-plugin-livereload';

// Rollup sets ROLLUP_WATCH when invoked with -w, so the dev server and
// livereload only run during `pnpm dev`, never during a production build.
const isWatch = process.env.ROLLUP_WATCH === 'true';

// The bundled stylesheet path, shared by the postcss extract target and the
// <link> href that htmlPlugin injects, so the two can never drift apart.
const CSS_ASSET_PATH = 'assets/index.css';

// Emit index.html into dist, rewriting the dev entry (/src/index.ts) to the
// built bundle and linking the extracted stylesheet. Both replacements are
// guarded: if index.html ever stops containing what we expect to rewrite, the
// build fails loudly instead of silently emitting a broken page.
function htmlPlugin() {
  return {
    name: 'html',
    generateBundle() {
      const source = fs.readFileSync(
        new URL('./index.html', import.meta.url),
        'utf8'
      );

      const withEntry = source.replace('/src/index.ts', '/assets/index.js');
      if (withEntry === source) {
        throw new Error(
          'htmlPlugin: expected to rewrite the dev entry "/src/index.ts" in index.html, but it was not found'
        );
      }

      const html = withEntry.replace(
        '</head>',
        `    <link rel="stylesheet" href="/${CSS_ASSET_PATH}" />\n  </head>`
      );
      if (html === withEntry) {
        throw new Error(
          'htmlPlugin: expected to inject the stylesheet link before "</head>" in index.html, but it was not found'
        );
      }

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
  // gt-react ships a "use client" directive that is meaningless in a
  // client-only bundle; suppress just that warning and let everything else pass.
  onwarn(warning, warn) {
    if (
      warning.code === 'MODULE_LEVEL_DIRECTIVE' &&
      warning.message.includes('use client')
    ) {
      return;
    }
    warn(warning);
  },
  plugins: [
    // The GT compiler must run first so it can transform <T>/t() before any
    // other plugin touches the source.
    gtCompiler(),
    replace({
      preventAssignment: true,
      'process.env.NODE_ENV': JSON.stringify(
        process.env.NODE_ENV ?? 'production'
      ),
      // GT credentials are read at build time and inlined. In this plain-Rollup
      // setup the committed src/_gt/*.json files are what renders, so these can
      // stay empty; see the README Credentials section for why on-the-fly dev
      // fetching does not activate here.
      'process.env.GT_PROJECT_ID': JSON.stringify(
        process.env.GT_PROJECT_ID ?? ''
      ),
      'process.env.GT_DEV_API_KEY': JSON.stringify(
        process.env.GT_DEV_API_KEY ?? ''
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
      extract: CSS_ASSET_PATH,
    }),
    htmlPlugin(),
    ...(isWatch
      ? [
          serve({
            contentBase: 'dist',
            host: '127.0.0.1',
            port: 5173,
            // Fall back to index.html so client-side routing works.
            historyApiFallback: true,
          }),
          livereload({ watch: 'dist' }),
        ]
      : []),
  ],
};
