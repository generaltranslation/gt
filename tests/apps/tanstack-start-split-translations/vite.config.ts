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
    tanstackStart(),
    react(),
    gtTanstackStart({
      // scripts/check.mjs builds the app once more from changed translations
      config: process.env.CHECK_CONFIG ?? 'gt.config.json',
      experimentalCompilerOptions: {
        type: 'babel',
        ...(messagesFile !== undefined && { _debugHashManifest: true }),
      },
    }),
    messagesFile !== undefined && collectMessages(messagesFile),
  ],
});
