import { defineConfig } from 'tsdown';
import {
  createTsdownUnbundleConfig,
  createUseClientBoundaryPlugin,
} from '../../tsdown.preset.mts';

export default defineConfig(
  createTsdownUnbundleConfig({
    format: 'cjs',
    cjsDefault: false,
    deps: {
      neverBundle: [/^server-only$/],
    },
    plugins: [
      createUseClientBoundaryPlugin({
        name: 'gt-next:use-client-boundaries',
        outputExtension: '.js',
      }),
    ],
  })
);
