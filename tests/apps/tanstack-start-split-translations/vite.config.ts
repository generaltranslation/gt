import { tanstackStart } from '@tanstack/react-start/plugin/vite';
import react from '@vitejs/plugin-react';
import { gtTanstackStart } from 'gt-tanstack-start/plugin/vite';
import { defineConfig } from 'vite';
import { collectMessages } from '../vite-chunk-translations/scripts/collectMessages.mjs';

// GT_SPLIT_TRANSLATIONS, GT_SPLIT_TRANSLATIONS_BY and GT_MINIFY_HASHES switch
// the split; scripts/check.mjs builds the app each way. CHECK_MESSAGES is set
// by scripts/pseudo-translate.mjs, which reads the app's messages from a
// build.
const messagesFile = process.env.CHECK_MESSAGES;

export default defineConfig({
  base: process.env.CHECK_BASE,
  build: { outDir: process.env.CHECK_OUT_DIR ?? 'dist' },
  plugins: [
    tanstackStart({
      // CHECK_SPLIT_LOADERS: the router also moves each route's loader out of
      // the entry chunk, where every page would carry its messages
      ...(process.env.CHECK_SPLIT_LOADERS === 'true' && {
        router: {
          codeSplittingOptions: {
            defaultBehavior: [
              ['loader'],
              ['component'],
              ['errorComponent'],
              ['notFoundComponent'],
            ],
          },
        },
      }),
      // CHECK_SPA: the app is a prerendered shell that every visitor gets
      ...(process.env.CHECK_SPA === 'true' && { spa: { enabled: true } }),
      // CHECK_PRERENDER: every route is also written as a static page
      ...(process.env.CHECK_PRERENDER === 'true' && {
        prerender: { enabled: true, crawlLinks: true },
        // With locale routing, a page of a translated locale too: no link
        // of the source locale's pages leads to it
        ...(process.env.CHECK_CONFIG && { pages: [{ path: '/fr/reports' }] }),
      }),
    }),
    react(),
    gtTanstackStart({
      // scripts/check.mjs builds the app once more from changed translations
      config: process.env.CHECK_CONFIG ?? 'gt.config.json',
      experimentalCompilerOptions: {
        type: 'babel',
        ...(messagesFile !== undefined && { _debugHashManifest: true }),
        // CHECK_REQUEST_COST: requestCost of the split by module, which has
        // no environment variable. At its default an app this small is one
        // file.
        ...(process.env.CHECK_REQUEST_COST && {
          experimentalSplitTranslations: {
            requestCost: Number(process.env.CHECK_REQUEST_COST),
          },
        }),
      },
    }),
    messagesFile !== undefined && collectMessages(messagesFile),
  ],
});
