import vue from '@vitejs/plugin-vue';
import { defineConfig } from 'vite';

// The bundle analysis app builds this example with GT_ANALYZE=1 and toggles
// minification and tree shaking through GT_ANALYZE_MINIFY / GT_ANALYZE_TREESHAKE.
const analyze = process.env.GT_ANALYZE === '1';
const minify = process.env.GT_ANALYZE_MINIFY !== '0';
const treeShake = process.env.GT_ANALYZE_TREESHAKE !== '0';

export default defineConfig({
  server: { port: 4613, strictPort: true },
  plugins: [vue()],
  build: {
    sourcemap: analyze,
    minify,
    rolldownOptions: { treeshake: treeShake },
  },
});
