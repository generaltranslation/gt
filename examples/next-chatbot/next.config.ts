import { withGTConfig } from 'gt-next/config';
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  experimental: {},
  images: {
    remotePatterns: [
      {
        hostname: 'avatar.vercel.sh',
      },
    ],
  },
};

export default withGTConfig(nextConfig, {
  locales: ['en', 'fr', 'es', 'zh'],
  defaultLocale: 'en',
});
