import { logError } from '../console/logging.js';

import chalk from 'chalk';
import path from 'node:path';
import fs from 'node:fs';
import { logErrorAndExit } from '../console/logging.js';
import { fromPackageRoot } from '../fs/getPackageResource.js';

// search for package.json such that we can run init in non-js projects
export async function searchForPackageJson(
  cwd: string = process.cwd()
): Promise<Record<string, any> | null> {
  // Get the current working directory (where the CLI is being run)
  const packageJsonPath = path.join(cwd, 'package.json');

  // Check if package.json exists
  if (!fs.existsSync(packageJsonPath)) {
    return null;
  }
  try {
    return JSON.parse(await fs.promises.readFile(packageJsonPath, 'utf8'));
  } catch (error) {
    return null;
  }
}

export async function getPackageJson(
  cwd: string = process.cwd()
): Promise<Record<string, any>> {
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
    return JSON.parse(await fs.promises.readFile(packageJsonPath, 'utf8'));
  } catch (error) {
    logError(chalk.red('Error parsing package.json: ' + String(error)));
    process.exit(1);
  }
}

export function getCLIVersion(): string {
  const packageJsonPath = fromPackageRoot('package.json');

  if (!fs.existsSync(packageJsonPath)) {
    return 'unknown';
  }
  try {
    return JSON.parse(fs.readFileSync(packageJsonPath, 'utf8')).version;
  } catch (error) {
    return 'unknown';
  }
}
export async function updatePackageJson(
  packageJson: Record<string, any>,
  cwd: string = process.cwd()
) {
  try {
    await fs.promises.writeFile(
      path.join(cwd, 'package.json'),
      JSON.stringify(packageJson, null, 2)
    );
  } catch (error) {
    logError(chalk.red('Error updating package.json: ' + String(error)));
    process.exit(1);
  }
}

// check if a package is installed in the package.json file
export function isPackageInstalled(
  packageName: string,
  packageJson: Record<string, any>,
  asDevDependency: boolean = false,
  checkBoth: boolean = false
): boolean {
  const dependencies = checkBoth
    ? {
        ...packageJson.devDependencies,
        ...packageJson.dependencies,
      }
    : asDevDependency
      ? packageJson.devDependencies
      : packageJson.dependencies;

  if (!dependencies) {
    return false;
  }
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
