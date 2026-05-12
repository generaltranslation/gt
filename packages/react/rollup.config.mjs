import {
  createReactBundleConfigs,
  createReactRollupBaseConfig,
} from '../../rollup.preset.mjs';

const baseConfig = createReactRollupBaseConfig({
  external: [
    'react',
    'react-dom',
    'generaltranslation',
    'generaltranslation/core',
    '@generaltranslation/supported-locales',
    '@generaltranslation/react-core',
  ],
});

export default createReactBundleConfigs(
  [
    { input: './src/index.ts', outputName: 'index' },
    { input: './src/internal.ts', outputName: 'internal' },
    {
      input: './src/internal-external-store.ts',
      outputName: 'internal-external-store',
    },
    { input: 'src/client.ts', outputName: 'client' },
    { input: './src/context.client.ts', outputName: 'context.client' },
    { input: './src/context.server.ts', outputName: 'context.server' },
    {
      input: './src/context.types.ts',
      outputName: 'context.types',
      bundle: false,
    },
    { input: './src/browser.ts', outputName: 'browser' },
    {
      input: './src/browser-types.ts',
      outputName: 'browser-types',
      bundle: false,
    },
    { input: './src/macros.ts', outputName: 'macros' },
  ],
  baseConfig
);
