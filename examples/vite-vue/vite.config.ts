import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';

export default defineConfig({
  plugins: [vue()],
  resolve: {
    // Linked workspace packages must share the app's Vue instance.
    dedupe: ['vue'],
  },
});
