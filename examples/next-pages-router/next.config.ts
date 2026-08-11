import type { NextConfig } from 'next';
import { withGTConfig } from 'gt-next/config';
import gtConfig from './gt.config.json';

const nextConfig: NextConfig = {
  i18n: {
    locales: gtConfig.locales,
    defaultLocale: gtConfig.defaultLocale,
    // Locale detection is enabled by default. Set localeDetection: false to disable it.
  },
  reactStrictMode: true,
};

export default withGTConfig(nextConfig);
