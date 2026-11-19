import { resolve } from 'node:path';
import react from '@vitejs/plugin-react';
import { vite as gtCompiler } from '@generaltranslation/compiler';
import { defineConfig, type Plugin } from 'vite';
import { collectMessages } from './scripts/collectMessages.mjs';

// GT_CHUNK_TRANSLATIONS=true turns the feature on; scripts/check.mjs builds
// the app both ways. CHECK_MESSAGES is set by scripts/pseudo-translate.mjs,
// which reads the app's messages from a build.
const messagesFile = process.env.CHECK_MESSAGES;

// Where the translation files are: the compiler reads them there, and so
// does the app's own loadTranslations. scripts/check.mjs builds the app once
// more from a copy with a changed translation.
const translations = process.env.CHECK_TRANSLATIONS ?? resolve('src/_gt');

// CHECK_IMPORT_MAP=true builds with Vite's chunk import map
// (`build.chunkImportMap`): chunks import each other by a name that stays
// when a chunk's content changes, which the page's import map resolves.
const importMap = process.env.CHECK_IMPORT_MAP === 'true';

// scripts/check.mjs also builds the app with a change to its JavaScript
// alone, in a module every route imports, which renames their chunks. With
// an import map the change renames only its own chunk, so it is in a route
// there, whose chunk has a translations file.
const revision = process.env.CHECK_REVISION;
const revised = importMap ? 'routes/Home.tsx' : 'shared/Badge.tsx';

/**
 * For scripts/check-module.mjs, with CHECK_ADD_IMPORT: the same app with one
 * more static import, of the shared statuses by the Home route, which did
 * not reach them.
 */
const addImport: Plugin = {
  name: 'check:add-import',
  enforce: 'pre',
  transform(code, id) {
    return id.endsWith('/src/routes/Home.tsx')
      ? `import '../shared/statuses';\n${code}`
      : null;
  },
};

/**
 * For scripts/check.mjs, with CHECK_SHARED_MESSAGE: the Settings route also
 * reads the message of the app's `msg` through a `t` template, and three
 * messages of compiled `t` templates through templates that hash them when
 * they run: with options and with a value the compiler cannot read. Each
 * message is then read by a compiled call site and by its hash.
 */
const addSharedMessage: Plugin = {
  name: 'check:add-shared-message',
  enforce: 'pre',
  transform(code, id) {
    return id.endsWith('/src/routes/Settings.tsx')
      ? `${code}
window.__notice = () => t\`Maintenance starts tonight\`;
window.__settings = (options) => t(options)\`Account settings\`;
window.__save = (options) => t(options)\`Save\`;
window.__hello = (who) => t\`Hello, \${who}!\`;`
      : null;
  },
};

export default defineConfig({
  plugins: [
    process.env.CHECK_ADD_IMPORT === 'true' && addImport,
    process.env.CHECK_SHARED_MESSAGE === 'true' && addSharedMessage,
    gtCompiler({
      _debugHashManifest: messagesFile !== undefined,
      files: { gt: { output: `${translations}/[locale].json` } },
      // CHECK_GT_LOG=debug prints what the build did with the translations
      ...(process.env.CHECK_GT_LOG === 'debug' && { logLevel: 'debug' }),
      // CHECK_PRECOMPUTE=false keeps the tagged templates of t, which the
      // compiler otherwise replaces with calls that pass a precomputed message
      ...(process.env.CHECK_PRECOMPUTE === 'false' && {
        precomputeMessages: false,
      }),
    }),
    react(),
    messagesFile !== undefined && collectMessages(messagesFile),
    revision !== undefined && {
      name: 'check-revision',
      transform: (code: string, id: string) =>
        id.endsWith(`/src/${revised}`)
          ? `${code}\nwindow.__revision = ${JSON.stringify(revision)};`
          : null,
    },
  ],
  resolve: {
    // pnpm installs gt-react's React peer into the workspace package, so its
    // imports can resolve a separate copy; bundle only the app's copy.
    dedupe: ['react', 'react-dom'],
    alias: { '@translations': translations },
  },
  // scripts/check.mjs builds pages/nested.html with a relative base
  base: process.env.CHECK_BASE,
  build: {
    outDir: process.env.CHECK_OUT_DIR ?? 'dist',
    chunkImportMap: importMap,
    // plain.html is the app without messages that are not split by chunk,
    // start.html the app started without a top-level await
    rollupOptions: {
      input: process.env.CHECK_ENTRY ?? 'index.html',
      output: {
        // CHECK_LAZY: a module runs when it is first imported, not when its
        // chunk loads. In a build without a top-level await, as of
        // start.html, the bundler then keeps a module that only a route and
        // a chunk the route imports use in the route's chunk, and writes the
        // import of that route as import(x).then((n) => (n.init(), n.exports)).
        ...(process.env.CHECK_LAZY === 'true' && {
          strictExecutionOrder: true,
        }),
        // For scripts/check-module.mjs. CHECK_ONE_CHUNK: the app is one
        // chunk, so the bundler writes the import of a route without an
        // import(): the page has the route's module already.
        ...(process.env.CHECK_ONE_CHUNK === 'true' && { codeSplitting: false }),
        // CHECK_SHARED_CHUNK: the shared modules, which different routes
        // use, are one chunk.
        ...(process.env.CHECK_SHARED_CHUNK === 'true' && {
          codeSplitting: {
            // Without what they import, or React would move in with them
            includeDependenciesRecursively: false,
            groups: [{ name: 'shared', test: /\/src\/shared\// }],
          },
        }),
      },
    },
  },
});
