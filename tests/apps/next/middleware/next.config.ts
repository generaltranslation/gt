import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';
import { withGTConfig } from 'gt-next/config';
import type { NextConfig } from 'next';

const appRoot = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(appRoot, '../../../..');

const nextConfig: NextConfig = {
  turbopack: {
    root: repoRoot,
  },
};

export default withGTConfig(nextConfig, {});
