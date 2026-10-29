import path from 'node:path';
import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import { vite as gtCompiler } from '@generaltranslation/compiler';
import { defineConfig } from 'vite';
import gtConfig from './gt.config.json' with { type: 'json' };

const appDir = path.dirname(fileURLToPath(import.meta.url));

/**
 * Tests build the app against edited copies of the translation files
 * (spec §9.7) without touching the committed ones.
 */
const translationsDir =
  process.env.GT_TWINS_TRANSLATIONS_DIR ?? path.join(appDir, 'src/_gt');

export default defineConfig({
  root: appDir,
  plugins: [
    gtCompiler({
      gtConfig: {
        ...gtConfig,
        files: {
          gt: {
            ...gtConfig.files.gt,
            output: path.join(translationsDir, '[locale].json'),
          },
        },
      },
      // Every attributed entry must be translated: a fallback to the
      // source text would weaken the isolation checks.
      localeTwins: { missingTranslations: 'error' },
    }),
    react(),
  ],
  // pnpm installs gt-react's React peer into the workspace package, so its
  // imports can resolve a separate copy; bundle only the app's copy.
  resolve: { dedupe: ['react', 'react-dom'] },
});
