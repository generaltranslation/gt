import fs from 'node:fs';
import path from 'node:path';
import { logError } from '../../console/logging.js';
import {
  detectEntryPoint,
  type EntryPointDetectionResult,
} from '../utils/detectEntryPoint.js';

export async function handleInitGT(
  babelConfigPath: string,
  indexPath: string,
  appRoot: string,
  errors: string[],
  warnings: string[],
  filesUpdated: string[],
  detectionResult?: EntryPointDetectionResult
) {
  try {
    // Detect entry point if not provided
    const detection = detectionResult || detectEntryPoint(appRoot);

    console.log(`[DEBUG] handleInitGT: Detection result:`, detection);
    console.log(`[DEBUG] handleInitGT: Strategy is "${detection.strategy}"`);

    // Check if babel.config.js exists
    const babelExists = fs.existsSync(babelConfigPath);
    let newContent = '';

    // Calculate relative path for babel config
    const relativeEntryPath = path.relative(appRoot, detection.absolutePath);
    console.log(`[DEBUG] handleInitGT: Relative entry path: ${relativeEntryPath}`);

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
          const gtPlugin = `\n      [\n        require('gt-react-native/plugin'),\n        {\n          entryPointFilePath: path.resolve(__dirname, '${relativeEntryPath}'),\n        },\n      ],`;
          newContent =
            newContent.slice(0, insertPoint) +
            gtPlugin +
            newContent.slice(insertPoint);
        }
      } else {
        // Update existing plugin with correct entry point
        newContent = newContent.replace(
          /entryPointFilePath:\s*path\.resolve\([^)]*\)/g,
          `entryPointFilePath: path.resolve(__dirname, '${relativeEntryPath}')`
        );
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
          entryPointFilePath: path.resolve(__dirname, '${relativeEntryPath}'),
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

    // Only create index.js if using wrapper strategy
    if (detection.strategy === 'create-wrapper' && !fs.existsSync(indexPath)) {
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

    // Only update package.json if using wrapper strategy
    if (detection.strategy === 'create-wrapper') {
      const packageJsonPath = path.resolve(appRoot, 'package.json');
      if (fs.existsSync(packageJsonPath)) {
        const packageJson = JSON.parse(
          fs.readFileSync(packageJsonPath, 'utf-8')
        );
        if (packageJson.main !== 'index.js') {
          packageJson.main = 'index.js';
          fs.writeFileSync(
            packageJsonPath,
            JSON.stringify(packageJson, null, 2)
          );
          filesUpdated.push(packageJsonPath);
        }
      }
    }
  } catch (error) {
    logError(`Error setting up React Native: ${error}`);
    errors.push(`Failed to set up React Native: ${error}`);
  }
}
