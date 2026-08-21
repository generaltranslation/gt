import type { NextConfig } from 'next';
import { withGTConfig } from 'gt-next/config';
import { getTurbopackRoot } from '../next/turbopackRoot';

const prefixDefaultLocale = process.env.GT_PREFIX_DEFAULT_LOCALE === 'true';
const buildName = `routing-prefix-default-${prefixDefaultLocale}`;

const nextConfig: NextConfig = {
  distDir: `.next-${buildName}`,
  turbopack: {
    root: getTurbopackRoot(import.meta.url),
  },
};

export default withGTConfig(nextConfig);
