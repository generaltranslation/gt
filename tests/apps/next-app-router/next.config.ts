import type { NextConfig } from 'next';
import { withGTConfig } from 'gt-next/config';
import { getTurbopackRoot } from '../next/turbopackRoot';

const nextConfig: NextConfig = {
  turbopack: {
    root: getTurbopackRoot(import.meta.url),
  },
};

// scripts/check.mjs sets CHECK_COMPILER, since experimentalSplitTranslations
// needs a compiler.
const compiler = process.env.CHECK_COMPILER;

export default withGTConfig(nextConfig, {
  ...((compiler === 'swc' || compiler === 'babel') && {
    experimentalCompilerOptions: { type: compiler },
  }),
});
