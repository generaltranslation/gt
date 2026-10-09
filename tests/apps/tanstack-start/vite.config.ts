import { tanstackStart } from '@tanstack/react-start/plugin/vite';
import react from '@vitejs/plugin-react';
import { gtTanstackStart } from 'gt-tanstack-start/plugin/vite';
import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    port: 5173,
    strictPort: true,
  },
  plugins: [
    tanstackStart(),
    react(),
    gtTanstackStart({
      // The e2e suite reuses this app with locale routing enabled.
      config: process.env.GT_TEST_CONFIG ?? 'gt.config.json',
      // Opted in so the e2e suite also covers compiled route chunks.
      experimentalCompilerOptions: { type: 'babel' },
    }),
  ],
});
