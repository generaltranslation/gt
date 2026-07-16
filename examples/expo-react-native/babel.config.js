const path = require('path');
const { plugin: gtPlugin } = require('gt-react-native/plugin');

module.exports = function (api) {
  api.cache(true);

  return {
    presets: [
      [
        'babel-preset-expo',
        {
          unstable_transformImportMeta: true,
        },
      ],
    ],
    plugins: [
      [
        gtPlugin,
        {
          entryPointFilePath: path.resolve(__dirname, 'index.ts'),
        },
      ],
    ],
  };
};
