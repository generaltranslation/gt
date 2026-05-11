import {
  createReactBundleConfigs,
  createReactRollupBaseConfig,
} from '../../rollup.preset.mjs';

const baseConfig = createReactRollupBaseConfig({
  external: [
    'react',
    '@generaltranslation/format',
    '@generaltranslation/format/types',
    'generaltranslation',
    '@generaltranslation/supported-locales',
  ],
});

export default createReactBundleConfigs(
  [
    { input: './src/index.ts', outputName: 'index' },
    { input: './src/internal.ts', outputName: 'internal' },
    { input: './src/errors.ts', outputName: 'errors' },
    { input: './src/types.ts', outputName: 'types', bundle: false },
  ],
  baseConfig
);
