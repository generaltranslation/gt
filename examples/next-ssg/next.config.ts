import { withGTConfig } from 'gt-next/config';
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
};

export default withGTConfig(nextConfig, {
  getLocalePath: 'src/i18n/getLocale.ts',
  getRegionPath: 'src/i18n/getRegion.ts',
  loadTranslationsPath: 'src/i18n/loadTranslations.ts',
});
