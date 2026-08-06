import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import vueJsx from '@vitejs/plugin-vue-jsx';

export default defineConfig({
  plugins: [vue(), vueJsx()],
  resolve: {
    // Linked packages and the host must share one Vue injection context.
    dedupe: ['vue'],
  },
});
