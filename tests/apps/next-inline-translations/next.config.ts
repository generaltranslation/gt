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

export default withGTConfig(nextConfig, {
  experimentalCompilerOptions: {
    type: compilerType,
    inlineTranslations: {
      locales: ['fr'],
      path: './translations/[locale].json',
    },
  },
});
