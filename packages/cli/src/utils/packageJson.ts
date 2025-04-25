import { logError } from '../console';

import chalk from 'chalk';
import path from 'path';
import fs from 'fs';
import { logErrorAndExit } from '../console';

export function getPackageJson(): Record<string, any> {
  // Get the current working directory (where the CLI is being run)
  const cwd = process.cwd();
  const packageJsonPath = path.join(cwd, 'package.json');

  // Check if package.json exists
  if (!fs.existsSync(packageJsonPath)) {
    logErrorAndExit(
      chalk.red(
        'No package.json found in the current directory. Please run this command from the root of your project.'
      )
    );
  }
  try {
    return JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
  } catch (error) {
    logError(chalk.red('Error parsing package.json: ' + String(error)));
    process.exit(1);
  }
}

export function updatePackageJson(packageJson: Record<string, any>) {
  try {
    fs.writeFileSync(
      path.join(process.cwd(), 'package.json'),
      JSON.stringify(packageJson, null, 2)
    );
  } catch (error) {
    logError(chalk.red('Error updating package.json: ' + String(error)));
    process.exit(1);
  }
}

export function isPackageInstalled(
  packageName: string,
  packageJson: Record<string, any>,
  asDevDependency: boolean = false
): boolean {
  const dependencies = asDevDependency
    ? packageJson.devDependencies
    : packageJson.dependencies;
  return dependencies[packageName] !== undefined;
}

export function getPackageVersion(
  packageName: string,
  packageJson: Record<string, any>
): string | undefined {
  const dependencies = {
    ...packageJson.dependencies,
    ...packageJson.devDependencies,
  };
  return dependencies[packageName] ?? undefined;
}
