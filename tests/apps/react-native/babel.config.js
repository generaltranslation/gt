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
        require('gt-react-native/plugin').default,
        {
          entryPointFilePath: path.resolve(__dirname, 'index.ts'),
        },
      ],
    ],
  };
};
