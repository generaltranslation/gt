import { withGTConfig } from 'gt-next/config';
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
};

export default withGTConfig(nextConfig, {
  getLocalePath: './i18n/getLocale.ts',
  getRegionPath: './i18n/getRegion.ts',
  loadTranslationsPath: './i18n/loadTranslations.ts',
});
