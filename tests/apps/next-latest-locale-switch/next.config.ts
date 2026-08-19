import type { NextConfig } from 'next';
import { withGTConfig } from 'gt-next/config';
import { getTurbopackRoot } from '../next/turbopackRoot';

const localeRouting = process.env.GT_LOCALE_ROUTING === 'true';
const prefixDefaultLocale = process.env.GT_PREFIX_DEFAULT_LOCALE === 'true';
const buildName = localeRouting
  ? `routing-prefix-default-${prefixDefaultLocale}`
  : 'no-routing';

const nextConfig: NextConfig = {
  distDir: `.next-${buildName}`,
  turbopack: {
    root: getTurbopackRoot(import.meta.url),
  },
};

export default withGTConfig(nextConfig);
