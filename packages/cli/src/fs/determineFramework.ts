import chalk from 'chalk';
import path from 'node:path';
import fs from 'node:fs';
import { SupportedLibraries } from '../types/index.js';
import { logWarning, logError } from '../console/logging.js';

export function determineLibrary(): {
  library: SupportedLibraries;
  additionalModules: SupportedLibraries[];
} {
  let library: SupportedLibraries = 'base';
  const additionalModules: SupportedLibraries[] = [];
  try {
    // Get the current working directory (where the CLI is being run)
    const cwd = process.cwd();
    const packageJsonPath = path.join(cwd, 'package.json');

    // Check if package.json exists
    if (!fs.existsSync(packageJsonPath)) {
      logWarning(
        chalk.yellow(
          'No package.json found in the current directory. Please run this command from the root of your project.'
        )
      );
      return { library: 'base', additionalModules: [] };
    }

    // Read and parse package.json
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
    const dependencies = {
      ...packageJson.dependencies,
      ...packageJson.devDependencies,
    };

    // Check for gt-next or gt-react in dependencies
    if (dependencies['gt-next']) {
      library = 'gt-next';
    } else if (dependencies['gt-react']) {
      library = 'gt-react';
    } else if (dependencies['gt-react-native']) {
      library = 'gt-react-native';
    } else if (dependencies['next-intl']) {
      library = 'next-intl';
    } else if (dependencies['i18next']) {
      library = 'i18next';
    }

    if (dependencies['i18next-icu']) {
      additionalModules.push('i18next-icu');
    }

    // Fallback to base if neither is found
    return { library, additionalModules };
  } catch (error) {
    logError('Error determining framework: ' + String(error));
    return { library: 'base', additionalModules: [] };
  }
}
