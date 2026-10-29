import { tanstackStart } from '@tanstack/react-start/plugin/vite';
import react from '@vitejs/plugin-react';
import { gtTanstackStart } from 'gt-tanstack-start/plugin/vite';
import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    port: 5183,
    strictPort: true,
  },
  // gtTanstackStart() goes after tanstackStart(), where `gt init` adds it, so
  // the compiler sees TanStack's split route modules.
  plugins: [
    tanstackStart(),
    react(),
    gtTanstackStart({
      // Tests build the app against edited copies of the translation files
      // (spec §9.7) through a config that points files.gt.output at them.
      config: process.env.GT_TWINS_CONFIG ?? 'gt.config.json',
      experimentalCompilerOptions: {
        type: 'babel',
        // Every attributed entry must be translated: a fallback to the
        // source text would weaken the isolation checks.
        localeTwins: { missingTranslations: 'error' },
      },
    }),
  ],
  // pnpm installs gt-tanstack-start's React peer into the workspace package,
  // so its imports can resolve a separate copy; bundle only the app's copy.
  resolve: { dedupe: ['react', 'react-dom'] },
});
