import { withGTConfig } from 'gt-next/config';
import type { NextConfig } from 'next';
import { getTurbopackRoot } from '../turbopackRoot';

const nextConfig: NextConfig = {
  turbopack: {
    root: getTurbopackRoot(import.meta.url),
  },
};

export default withGTConfig(nextConfig, {});
