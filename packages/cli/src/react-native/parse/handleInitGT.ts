import fs from 'node:fs';
import path from 'node:path';
import { logError } from '../../console/logging.js';

export async function handleInitGT(
  babelConfigPath: string,
  indexPath: string,
  appRoot: string,
  errors: string[],
  warnings: string[],
  filesUpdated: string[]
) {
  try {
    // Check if babel.config.js exists
    const babelExists = fs.existsSync(babelConfigPath);
    let newContent = '';

    if (babelExists) {
      // Parse existing babel config and add gt-react-native plugin
      const existingContent = fs.readFileSync(babelConfigPath, 'utf-8');

      // Check if path require is already there
      newContent = existingContent;
      if (!existingContent.includes('const path = require')) {
        // Add path require at the beginning after any existing comments/requires
        newContent = `const path = require('path');\n${existingContent}`;
      }

      // Check if gt-react-native plugin is already there
      if (!newContent.includes('gt-react-native/plugin')) {
        // Find the plugins array and add our plugin
        const pluginsMatch = newContent.match(/plugins:\s*\[/);
        if (pluginsMatch) {
          const insertPoint = pluginsMatch.index! + pluginsMatch[0].length;
          const gtPlugin = `\n      [\n        require('gt-react-native/plugin'),\n        {\n          entryPointFilePath: path.resolve(__dirname, './index.js'),\n        },\n      ],`;
          newContent =
            newContent.slice(0, insertPoint) +
            gtPlugin +
            newContent.slice(insertPoint);
        }
      }

      fs.writeFileSync(babelConfigPath, newContent);
      filesUpdated.push(babelConfigPath);
    } else {
      // Create new babel.config.js
      const babelContent = `const path = require('path');

module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      [
        require('gt-react-native/plugin'),
        {
          entryPointFilePath: path.resolve(__dirname, './index.js'),
        },
      ],
      'react-native-reanimated/plugin', // Has to be listed last
    ],
  };
};
`;
      fs.writeFileSync(babelConfigPath, babelContent);
      filesUpdated.push(babelConfigPath);
    }

    // Create index.js if it doesn't exist
    if (!fs.existsSync(indexPath)) {
      const indexContent = `import { registerRootComponent } from 'expo';
import { ExpoRoot } from 'expo-router';

export function App() {
  const ctx = require.context('./app');
  return <ExpoRoot context={ctx} />;
}

registerRootComponent(App);
`;
      fs.writeFileSync(indexPath, indexContent);
      filesUpdated.push(indexPath);
    }

    // Update package.json main field
    const packageJsonPath = path.resolve(appRoot, 'package.json');
    if (fs.existsSync(packageJsonPath)) {
      const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
      if (packageJson.main !== 'index.js') {
        packageJson.main = 'index.js';
        fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2));
        filesUpdated.push(packageJsonPath);
      }
    }
  } catch (error) {
    logError(`Error setting up React Native: ${error}`);
    errors.push(`Failed to set up React Native: ${error}`);
  }
}
