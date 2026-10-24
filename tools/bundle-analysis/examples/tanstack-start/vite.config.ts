import { tanstackStart } from '@tanstack/react-start/plugin/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// The bundle analysis app builds this example with GT_ANALYZE=1 and toggles
// minification and tree shaking through GT_ANALYZE_MINIFY / GT_ANALYZE_TREESHAKE.
const analyze = process.env.GT_ANALYZE === '1';
const minify = process.env.GT_ANALYZE_MINIFY !== '0';
const treeShake = process.env.GT_ANALYZE_TREESHAKE !== '0';

export default defineConfig({
  server: { port: 4611, strictPort: true },
  plugins: [tanstackStart(), react()],
  build: {
    sourcemap: analyze,
    minify,
    rolldownOptions: { treeshake: treeShake },
  },
});
