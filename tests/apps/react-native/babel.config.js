const path = require('path');

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
        require('gt-react-native/plugin').plugin,
        {
          entryPointFilePath: path.resolve(__dirname, 'index.ts'),
        },
      ],
    ],
  };
};
