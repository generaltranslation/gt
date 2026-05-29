import type { NextConfig } from 'next';
import { getTurbopackRoot } from '../next/turbopackRoot';

const nextConfig: NextConfig = {
  turbopack: {
    root: getTurbopackRoot(import.meta.url),
  },
};

export default nextConfig;
