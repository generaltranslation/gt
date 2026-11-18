import type { NextConfig } from 'next';
import { withGTConfig } from 'gt-next/config';
import { getTurbopackRoot } from '../next/turbopackRoot';

const nextConfig: NextConfig = {
  turbopack: {
    root: getTurbopackRoot(import.meta.url),
  },
};

// GT_TEST_INLINE_MODULES=physical (or virtual) imports each embedded
// translation from its own module in .gt/messages
const modules = process.env.GT_TEST_INLINE_MODULES;

export default withGTConfig(nextConfig, {
  ...(modules && { config: `./gt.${modules}-modules.config.json` }),
  experimentalCompilerOptions: { type: 'swc' },
});
