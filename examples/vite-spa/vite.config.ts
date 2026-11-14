import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { vite as gtCompiler } from '@generaltranslation/compiler';
import { gtReact } from 'gt-react/vite';
import gtConfig from './gt.config.json' with { type: 'json' };

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), gtCompiler(gtConfig), gtReact()],
  resolve: {
    // Workspace-linked packages must share the app's React instance. Standalone apps do not need this.
    dedupe: ['react', 'react-dom'],
  },
});
