import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 4599,
    proxy: {
      '/api': { target: 'http://localhost:4600', changeOrigin: true },
      '/previews': { target: 'http://localhost:4600', changeOrigin: true },
    },
  },
});
