import {
  createReactBundleConfigs,
  createReactRollupBaseConfig,
} from '../../rollup.preset.mjs';

const baseConfig = createReactRollupBaseConfig({
  external: [
    'react',
    'generaltranslation',
    'generaltranslation/core',
    '@generaltranslation/supported-locales',
  ],
});

export default createReactBundleConfigs(
  [
    { input: './src/index.ts', outputName: 'index' },
    { input: './src/internal.ts', outputName: 'internal' },
    { input: './src/context.ts', outputName: 'context' },
    { input: './src/errors.ts', outputName: 'errors' },
    { input: './src/types.ts', outputName: 'types', bundle: false },
  ],
  baseConfig
);
