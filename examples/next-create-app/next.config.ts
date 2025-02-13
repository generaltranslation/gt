import type { NextConfig } from 'next';
import { initGT } from 'gt-next/config';

const nextConfig: NextConfig = {
  /* config options here */
};

const withGT = initGT({
  defaultLocale: 'en-US',
  locales: ['en-US', 'fr', 'es', 'zh'],
});

export default withGT(nextConfig);
