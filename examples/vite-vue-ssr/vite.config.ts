import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';

export default defineConfig({
  plugins: [vue()],
  resolve: {
    // Linked packages and the host must share one Vue injection context.
    dedupe: ['vue'],
  },
});
