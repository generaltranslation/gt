import type { BundlerConfig } from './bundler-config.js';
import { viteConfig } from './vite.js';
import { rspackConfig, webpackConfig } from './webpack.js';

/** With several configs in a project, the first counts. */
export const defaultBundlerConfigs: readonly BundlerConfig[] = [
  viteConfig,
  webpackConfig,
  rspackConfig,
];
