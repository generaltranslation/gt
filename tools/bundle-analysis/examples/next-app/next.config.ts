import type { NextConfig } from 'next';
import { withGTConfig } from 'gt-next/config';
import { getTurbopackRoot } from './turbopackRoot';

// The bundle analysis app builds this example with GT_ANALYZE=1 and toggles
// minification and tree shaking through GT_ANALYZE_MINIFY / GT_ANALYZE_TREESHAKE.
const analyze = process.env.GT_ANALYZE === '1';
const minify = process.env.GT_ANALYZE_MINIFY !== '0';
const treeShake = process.env.GT_ANALYZE_TREESHAKE !== '0';

const nextConfig: NextConfig = {
  turbopack: {
    root: getTurbopackRoot(import.meta.url),
  },
  productionBrowserSourceMaps: analyze,
  // Type checking is not needed for bundle measurement and slows rebuilds.
  typescript: { ignoreBuildErrors: analyze },
  experimental: {
    serverSourceMaps: analyze,
    // Map bytes to the published dist files, like the Vite examples do,
    // instead of following gt package source maps back to src.
    turbopackInputSourceMaps: !analyze,
    turbopackMinify: minify,
    ...(treeShake
      ? {}
      : {
          turbopackTreeShaking: false,
          turbopackRemoveUnusedExports: false,
          turbopackRemoveUnusedImports: false,
          turbopackInferModuleSideEffects: false,
        }),
  },
};

export default withGTConfig(nextConfig);
