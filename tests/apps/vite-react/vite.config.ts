import react from '@vitejs/plugin-react';
import { vite as gtCompiler } from '@generaltranslation/compiler';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [gtCompiler(), react()],
  // Workspace gt-react resolves its own devDependency React; bundle only the
  // app's copy, as the other bundler test apps do.
  resolve: { dedupe: ['react', 'react-dom'] },
});
