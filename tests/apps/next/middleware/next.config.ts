import { createRequire } from 'module';
import { dirname, isAbsolute, relative, resolve } from 'path';
import { fileURLToPath } from 'url';
import { withGTConfig } from 'gt-next/config';
import type { NextConfig } from 'next';

const require = createRequire(import.meta.url);
const appRoot = dirname(fileURLToPath(import.meta.url));
const nextPackageRoot = dirname(require.resolve('next/package.json'));

function getTurbopackRoot(): string {
  let root = resolve(appRoot);

  while (true) {
    const diff = relative(root, nextPackageRoot);
    if (diff === '' || (!diff.startsWith('..') && !isAbsolute(diff))) {
      return root;
    }

    const parent = dirname(root);
    if (parent === root) return parent;
    root = parent;
  }
}

const nextConfig: NextConfig = {
  turbopack: {
    root: getTurbopackRoot(),
  },
};

export default withGTConfig(nextConfig, {});
