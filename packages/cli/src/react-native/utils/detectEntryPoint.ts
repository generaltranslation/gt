import fs from 'node:fs';
import path from 'node:path';
import { logWarning } from '../../console/logging.js';

export interface EntryPointDetectionResult {
  entryPoint: string;
  strategy: 'use-existing' | 'create-wrapper';
  description: string;
  absolutePath: string;
  originalMain?: string;
}

/**
 * Detects the appropriate entry point for a React Native/Expo project.
 *
 * Strategy:
 * 1. If package.json main is in node_modules (e.g., expo-router/entry) → create wrapper
 * 2. If main points to existing project file → use existing
 * 3. Otherwise check common entry points (index.js, App.js, etc.)
 */
export function detectEntryPoint(
  projectRoot: string
): EntryPointDetectionResult {
  try {
    // Read package.json
    const packageJsonPath = path.join(projectRoot, 'package.json');
    if (!fs.existsSync(packageJsonPath)) {
      throw new Error('package.json not found');
    }

    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
    const currentMain = packageJson.main || 'index.js';

    console.log(`[DEBUG] Detecting entry point for: ${projectRoot}`);
    console.log(`[DEBUG] package.json main field: ${currentMain}`);

    // Check if main points to existing project file (check file existence first)
    const mainPath = path.join(projectRoot, currentMain);
    console.log(`[DEBUG] Checking if main path exists: ${mainPath}`);
    if (fs.existsSync(mainPath)) {
      console.log(`[DEBUG] ✓ Main entry point exists! Using: ${currentMain}`);
      return {
        entryPoint: currentMain,
        strategy: 'use-existing',
        description: `Using existing entry point: ${currentMain}`,
        absolutePath: mainPath,
      };
    }
    console.log(`[DEBUG] ✗ Main entry point does not exist at: ${mainPath}`);

    // Also try with common extensions if main doesn't have one
    if (!currentMain.includes('.')) {
      const extensions = ['.js', '.ts', '.jsx', '.tsx'];
      for (const ext of extensions) {
        const pathWithExt = path.join(projectRoot, currentMain + ext);
        if (fs.existsSync(pathWithExt)) {
          const entryPoint = currentMain + ext;
          return {
            entryPoint,
            strategy: 'use-existing',
            description: `Using existing entry point: ${entryPoint}`,
            absolutePath: pathWithExt,
          };
        }
      }
    }

    // Check if current main is in node_modules (needs wrapper strategy)
    // Only after checking that the file doesn't exist locally
    if (isNodeModulesEntry(currentMain)) {
      return {
        entryPoint: 'index.js',
        strategy: 'create-wrapper',
        originalMain: currentMain,
        description: `Current main (${currentMain}) is in node_modules. Will create index.js as wrapper.`,
        absolutePath: path.resolve(projectRoot, 'index.js'),
      };
    }

    // Try common entry points
    const commonEntryPoints = [
      'index.js',
      'index.tsx',
      'App.js',
      'App.tsx',
      'src/index.js',
      'src/index.tsx',
      'src/App.js',
      'src/App.tsx',
    ];

    for (const entry of commonEntryPoints) {
      const fullPath = path.join(projectRoot, entry);
      if (fs.existsSync(fullPath)) {
        return {
          entryPoint: entry,
          strategy: 'use-existing',
          description: `Found existing entry point: ${entry}`,
          absolutePath: fullPath,
        };
      }
    }

    // Fallback: suggest creating index.js
    logWarning(
      `Could not detect existing entry point. Will create index.js as wrapper.`
    );
    return {
      entryPoint: 'index.js',
      strategy: 'create-wrapper',
      originalMain: currentMain,
      description: `No existing entry point found. Will create index.js as wrapper.`,
      absolutePath: path.resolve(projectRoot, 'index.js'),
    };
  } catch (error) {
    throw new Error(`Failed to detect entry point: ${String(error)}`);
  }
}

/**
 * Check if a main entry is in node_modules or is a package reference
 */
function isNodeModulesEntry(main: string): boolean {
  // Check for common patterns
  return (
    main.includes('node_modules') ||
    main === 'expo-router/entry' ||
    main === 'expo-router/entry-classic' ||
    main === 'expo/entry' ||
    // Check if it's a package reference (starts with @ or is unscoped package)
    (!/^\./.test(main) && !main.includes('.js') && !main.includes('.ts'))
  );
}
