import react from '@vitejs/plugin-react';
import { vite as gtCompiler } from '@generaltranslation/compiler';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [gtCompiler(), react()],
  // pnpm installs gt-react's React peer into the workspace package, so its
  // imports can resolve a separate copy; bundle only the app's copy, as the
  // other bundler test apps do.
  resolve: { dedupe: ['react', 'react-dom'] },
});
