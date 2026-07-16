import react from '@vitejs/plugin-react';
import { vite as gtCompiler } from '@generaltranslation/compiler';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [gtCompiler(), react()],
});
