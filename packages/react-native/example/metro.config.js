const path = require('path');
const { getDefaultConfig } = require('@react-native/metro-config');
const { withMetroConfig } = require('react-native-monorepo-config');

const root = path.resolve(__dirname, '..', '..', '..');
const config = withMetroConfig(getDefaultConfig(__dirname), {
  root,
  dirname: __dirname,
});

config.watchFolders.push(path.resolve(root));
config.resolver.nodeModulesPaths.push(
  path.resolve(root, 'node_modules'),
  path.resolve(root, 'packages', 'react-native', 'node_modules'),
  path.resolve(root, 'packages', 'react-native', 'example', 'node_modules')
);

// // Custom resolver for local package development
const originalResolveRequest = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  // Alias react to resolve from parent directory's node_modules
  if (moduleName === 'react') {
    return {
      type: 'sourceFile',
      filePath: path.resolve(
        __dirname,
        '..',
        'node_modules',
        'react',
        'index.js'
      ),
    };
  }

  if (
    moduleName === 'gt-react-native' ||
    moduleName.startsWith('gt-react-native/')
  ) {
    try {
      const packagePath = path.resolve(
        root,
        'packages',
        'react-native',
        'package.json'
      );
      const packageJson = require(packagePath);

      if (moduleName === 'gt-react-native') {
        // Use built files for main export
        const builtPath = path.resolve(
          root,
          'packages',
          'react-native',
          packageJson.exports['.'].default
        );
        if (require('fs').existsSync(builtPath)) {
          return {
            type: 'sourceFile',
            filePath: builtPath,
          };
        }
      } else if (moduleName === 'gt-react-native/internal') {
        const builtPath = path.resolve(
          root,
          'packages',
          'react-native',
          packageJson.exports['./internal'].default
        );
        if (require('fs').existsSync(builtPath)) {
          return {
            type: 'sourceFile',
            filePath: builtPath,
          };
        }
      }
    } catch (error) {
      // Fall back to default resolution if custom resolution fails
    }
  }

  // Fallback to default resolver
  if (originalResolveRequest) {
    return originalResolveRequest(context, moduleName, platform);
  }
  return context.resolveRequest(context, moduleName, platform);
};

/**
 * Metro configuration
 * https://facebook.github.io/metro/docs/configuration
 *
 * @type {import('metro-config').MetroConfig}
 */

module.exports = config;
