const path = require('path');

module.exports = {
  project: {
    ios: {
      automaticPodsInstallation: false,
    },
  },
  dependencies: {
    'gt-react-native': {
      root: path.resolve(__dirname, '..', '..', 'packages', 'react-native'),
      platforms: {
        ios: {},
        android: {},
      },
    },
  },
};
