import { createMDX } from 'fumadocs-mdx/next';
import { withGTConfig } from 'gt-next/config';

const withMDX = createMDX();

/** @type {import('next').NextConfig} */
const config = {
  reactStrictMode: true,
  devIndicators: false,
  assetPrefix: '/docs-static',
};

export default withGTConfig(withMDX(config), {
  defaultLocale: 'en',
  dictionary: 'content/ui.en.json',
});
