import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// The bundle analysis app builds this example with GT_ANALYZE=1 and toggles
// minification and tree shaking through GT_ANALYZE_MINIFY / GT_ANALYZE_TREESHAKE.
const analyze = process.env.GT_ANALYZE === '1';
const minify = process.env.GT_ANALYZE_MINIFY !== '0';
const treeShake = process.env.GT_ANALYZE_TREESHAKE !== '0';

export default defineConfig({
  plugins: [react()],
  // gt-react is linked from the workspace, where it resolves its own React
  // dev dependency. Dedupe so the app and the library share one React copy,
  // as they would after a registry install.
  resolve: { dedupe: ['react', 'react-dom'] },
  build: {
    sourcemap: analyze,
    minify,
    rolldownOptions: { treeshake: treeShake },
  },
});
