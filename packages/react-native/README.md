# gt-react-native

An i18n package for React Native

## Installation

```sh
npm install gt-react-native
```

## Local development

In order to link local librarys add this to your package.json:

```json
{
  "dependencies": {
    "example-lib": "*"
  },
  "resolutions": {
    "@generaltranslation/react-core": "portal:/absolute/path/to/test-lib"
  }
}
```

And update the `metro.config.js` in the `/example` directory for local linking:

```js
const testLibAbsolutePath = '/absolute/path/to/test-lib';

const mergedConfig = {
  ...defaultConfig,
  resolver: {
    ...defaultConfig.resolver,
    extraNodeModules: {
      ...defaultConfig.resolver.extraNodeModules,
      'test-lib': testLibAbsolutePath,
    },
    nodeModulesPaths: [
      ...defaultConfig.resolver.nodeModulesPaths,
      `${testLibAbsolutePath}/node_modules`,
    ],
  },
  watchFolders: [...defaultConfig.watchFolders, testLibAbsolutePath],
};
```

If you are having issues resolving a dependency in test-lib, then provide the direct path in `extraNodeModules` mapping to `'/absolute/path/to/test-lib/node_modules/example-lib'`.

---

Made with [create-react-native-library](https://github.com/callstack/react-native-builder-bob)
