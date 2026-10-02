import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 4599,
    proxy: {
      '/api': 'http://localhost:4600',
      '/previews': 'http://localhost:4600',
    },
  },
});
