import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { rollup as gtCompiler } from '@generaltranslation/compiler';
import { defineConfig } from 'rolldown';

const appDir = path.dirname(fileURLToPath(import.meta.url));
const reactDir = fs.realpathSync(path.join(appDir, 'node_modules/react'));
const reactDomDir = fs.realpathSync(
  path.join(appDir, 'node_modules/react-dom')
);

function cssAssetPlugin() {
  return {
    name: 'css-asset',
    buildStart() {
      this.emitFile({
        type: 'asset',
        fileName: 'assets/styles.css',
        source: fs.readFileSync(path.join(appDir, 'src/styles.css'), 'utf8'),
      });
    },
  };
}

function htmlPlugin() {
  return {
    name: 'html',
    generateBundle() {
      const html = fs
        .readFileSync(new URL('./index.html', import.meta.url), 'utf8')
        .replace('/src/index.ts', '/assets/index.js')
        .replace(
          '</head>',
          '    <link rel="stylesheet" href="/assets/styles.css" />\n  </head>'
        );

      this.emitFile({
        type: 'asset',
        fileName: 'index.html',
        source: html,
      });
    },
  };
}

export default defineConfig({
  input: 'src/index.ts',
  output: {
    dir: 'dist',
    format: 'esm',
    sourcemap: true,
    entryFileNames: 'assets/[name].js',
    chunkFileNames: 'assets/[name]-[hash].js',
    assetFileNames: 'assets/[name][extname]',
  },
  define: {
    'process.env.NODE_ENV': JSON.stringify(
      process.env.NODE_ENV ?? 'production'
    ),
  },
  moduleTypes: {
    '.css': 'empty',
  },
  resolve: {
    alias: {
      react: reactDir,
      'react-dom': reactDomDir,
    },
  },
  plugins: [gtCompiler(), cssAssetPlugin(), htmlPlugin()],
});
