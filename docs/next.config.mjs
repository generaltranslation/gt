import { createMDX } from 'fumadocs-mdx/next';
import { withGTConfig } from 'gt-next/config';

const withMDX = createMDX();

/** @type {import('next').NextConfig} */
const config = {
  reactStrictMode: true,
  devIndicators: false,
  assetPrefix: '/docs-static',
  async redirects() {
    return [
      {
        source: '/:locale/docs',
        destination: '/:locale/docs/platform',
        permanent: true,
      },
      {
        source: '/docs',
        destination: '/docs/platform',
        permanent: true,
      },
    ];
  },
  async rewrites() {
    return [
      {
        source: '/ingest/static/:path*',
        destination: 'https://us-assets.i.posthog.com/static/:path*',
      },
      {
        source: '/ingest/:path*',
        destination: 'https://us.i.posthog.com/:path*',
      },
      {
        source: '/ingest/decide',
        destination: 'https://us.i.posthog.com/decide',
      },
    ];
  },
  // This is required to support PostHog trailing slash API requests
  skipTrailingSlashRedirect: true,
};

export default withGTConfig(withMDX(config), {
  defaultLocale: 'en',
  dictionary: 'content/ui.en.json',
  loadTranslationsPath: 'loadTranslations.ts',
});