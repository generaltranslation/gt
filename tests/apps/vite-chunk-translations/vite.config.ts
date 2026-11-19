import { resolve } from 'node:path';
import react from '@vitejs/plugin-react';
import { vite as gtCompiler } from '@generaltranslation/compiler';
import { defineConfig } from 'vite';
import { collectMessages } from './scripts/collectMessages.mjs';

// GT_CHUNK_TRANSLATIONS=true turns the feature on; scripts/check.mjs builds
// the app both ways. CHECK_MESSAGES is set by scripts/pseudo-translate.mjs,
// which reads the app's messages from a build.
const messagesFile = process.env.CHECK_MESSAGES;

// Where the translation files are: the compiler reads them there, and so
// does the app's own loadTranslations. scripts/check.mjs builds the app once
// more from a copy with a changed translation.
const translations = process.env.CHECK_TRANSLATIONS ?? resolve('src/_gt');

// scripts/check.mjs also builds the app with a change to its JavaScript
// alone, in a module every route imports, which renames their chunks.
const revision = process.env.CHECK_REVISION;

export default defineConfig({
  plugins: [
    gtCompiler({
      _debugHashManifest: messagesFile !== undefined,
      files: { gt: { output: `${translations}/[locale].json` } },
    }),
    react(),
    messagesFile !== undefined && collectMessages(messagesFile),
    revision !== undefined && {
      name: 'check-revision',
      transform: (code: string, id: string) =>
        id.endsWith('/src/shared/Badge.tsx')
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
      },
    },
  },
});
