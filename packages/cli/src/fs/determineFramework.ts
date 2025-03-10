import chalk from 'chalk';
import path from 'path';
import fs from 'fs';
import { SupportedLibraries } from '../types';

export function determineLibrary(): SupportedLibraries {
  try {
    // Get the current working directory (where the CLI is being run)
    const cwd = process.cwd();
    const packageJsonPath = path.join(cwd, 'package.json');

    // Check if package.json exists
    if (!fs.existsSync(packageJsonPath)) {
      console.log(
        chalk.red(
          'No package.json found in the current directory. Please run this command from the root of your project.'
        )
      );
      return 'base';
    }

    // Read and parse package.json
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
    const dependencies = {
      ...packageJson.dependencies,
      ...packageJson.devDependencies,
    };

    // Check for gt-next or gt-react in dependencies
    if (dependencies['gt-next']) {
      return 'gt-next';
    } else if (dependencies['gt-react']) {
      return 'gt-react';
    } else if (dependencies['next-intl']) {
      return 'next-intl';
    } else if (dependencies['react-i18next']) {
      return 'react-i18next';
    } else if (dependencies['next-i18next']) {
      return 'next-i18next';
    }

    // Fallback to base if neither is found
    return 'base';
  } catch (error) {
    console.error('Error determining framework:', error);
    return 'base';
  }
}
