import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  // The window loads the built page from a file, so asset paths are relative.
  base: './',
  plugins: [react()],
  resolve: {
    // Workspace-linked packages must share the app's React instance. Standalone apps do not need this.
    dedupe: ['react', 'react-dom'],
  },
});
