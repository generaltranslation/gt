import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { vite as gtPlugin } from '@generaltranslation/compiler';
import gtConfig from './gt.config.json';

export default defineConfig({
  plugins: [
    react(),
    gtPlugin({
      gtConfig,
      _debugHashManifest: true,
    }),
  ],
});
