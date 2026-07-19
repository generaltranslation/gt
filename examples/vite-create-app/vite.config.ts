import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { vite as gtCompiler } from '@generaltranslation/compiler';
import gtConfig from './gt.config.json' with { type: 'json' };

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), gtCompiler(gtConfig)],
  resolve: {
    // Linked workspace packages must share the app's React instance.
    dedupe: ['react', 'react-dom'],
  },
});
