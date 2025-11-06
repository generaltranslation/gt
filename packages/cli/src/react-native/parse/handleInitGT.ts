import fs from 'node:fs';
import path from 'node:path';
import { logError } from '../../console/logging.js';
import { updateBabelConfig } from '../utils/updateBabelConfig.js';
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

    // Calculate relative path for babel config
    const relativeEntryPath = path.relative(appRoot, detection.absolutePath);

    // Update or create babel config using AST manipulation
    const babelModified = updateBabelConfig(
      babelConfigPath,
      relativeEntryPath,
      true
    );
    if (babelModified) {
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
