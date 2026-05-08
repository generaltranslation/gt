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
    { input: 'src/client.ts', outputName: 'client' },
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
