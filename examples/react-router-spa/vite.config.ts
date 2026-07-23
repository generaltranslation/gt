import { reactRouter } from '@react-router/dev/vite';
import { vite as gtCompiler } from '@generaltranslation/compiler';
import { defineConfig } from 'vite';
import gtConfig from './gt.config.json' with { type: 'json' };

// https://vite.dev/config/
export default defineConfig({
  plugins: [reactRouter(), gtCompiler(gtConfig)],
  resolve: {
    // Linked workspace packages must share the app's React instance.
    dedupe: ['react', 'react-dom'],
  },
});
