const path = require('path');
const { getDefaultConfig } = require('@react-native/metro-config');
const { withMetroConfig } = require('react-native-monorepo-config');

const root = path.resolve(__dirname, '..');
const defaultConfig = withMetroConfig(getDefaultConfig(__dirname), {
  root,
  dirname: __dirname,
});

const mergedConfig = {
  ...defaultConfig,
  resolver: {
    ...defaultConfig.resolver,
    extraNodeModules: {
      ...defaultConfig.resolver.extraNodeModules,
    },
    nodeModulesPaths: [
      ...defaultConfig.resolver.nodeModulesPaths,
      '/Users/ernestmccarter/Documents/dev/gt-react-native/node_modules',
    ],
  },
  watchFolders: [...defaultConfig.watchFolders],
};

/**
 * Metro configuration
 * https://facebook.github.io/metro/docs/configuration
 *
 * @type {import('metro-config').MetroConfig}
 */
const config = mergedConfig;

module.exports = config;
