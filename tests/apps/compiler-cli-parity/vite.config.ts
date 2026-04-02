import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { vite as gtPlugin } from '@generaltranslation/compiler';

export default defineConfig({
  plugins: [
    react(),
    gtPlugin({
      enableAutoJsxInjection: true,
      _debugHashManifest: true,
    }),
  ],
});
