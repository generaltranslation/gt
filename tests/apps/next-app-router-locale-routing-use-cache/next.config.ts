import type { NextConfig } from 'next';
import { withGTConfig } from 'gt-next/config';
import { getTurbopackRoot } from '../next/turbopackRoot';

const nextConfig: NextConfig = {
  cacheComponents: true,
  turbopack: {
    root: getTurbopackRoot(import.meta.url),
  },
};

export default withGTConfig(nextConfig);
