const path = require('path');
const { getConfig } = require('react-native-builder-bob/babel-config');
const pkg = require('../../packages/react-native/package.json');

const root = path.resolve(__dirname, '..', '..', 'packages', 'react-native');

const config = getConfig(
  {
    presets: ['module:@react-native/babel-preset'],
  },
  { root, pkg }
);

module.exports = {
  ...config,
  plugins: [
    ...(config.plugins || []),
    [require('gt-react-native/plugin').default, {}],
  ],
};
