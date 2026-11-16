import type { NextConfig } from 'next';
import { withGTConfig } from 'gt-next/config';
import { getTurbopackRoot } from '../next/turbopackRoot';

const nextConfig: NextConfig = {
  turbopack: {
    root: getTurbopackRoot(import.meta.url),
  },
};

// GT_TEST_COMPILER=babel checks the babel compiler, which needs webpack:
// GT_TEST_COMPILER=babel next build --webpack
const compilerType = process.env.GT_TEST_COMPILER === 'babel' ? 'babel' : 'swc';

// GT_TEST_INLINE_MODULES=1 imports each embedded translation from its own
// module in .gt/messages instead of embedding it at the call site
const config =
  process.env.GT_TEST_INLINE_MODULES === '1'
    ? './gt.modules.config.json'
    : undefined;

export default withGTConfig(nextConfig, {
  config,
  experimentalCompilerOptions: { type: compilerType },
});
