import type { NextConfig } from 'next';
import { withGTConfig } from 'gt-next/config';
import { getTurbopackRoot } from '../next/turbopackRoot';
import gtConfig from './gt.config.json';

const nextConfig: NextConfig = {
  i18n: {
    locales: gtConfig.locales,
    defaultLocale: gtConfig.defaultLocale,
    // Locale detection is enabled by default. Set localeDetection: false to disable it.
  },
  turbopack: {
    root: getTurbopackRoot(import.meta.url),
  },
};

export default withGTConfig(nextConfig);
