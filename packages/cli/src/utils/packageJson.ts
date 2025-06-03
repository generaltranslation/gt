import { logError } from '../console';

import chalk from 'chalk';
import path from 'node:path';
import fs from 'node:fs';
import { logErrorAndExit } from '../console';
import { fromPackageRoot } from '../fs/getPackageResource';

// search for package.json such that we can run init in non-js projects
export async function searchForPackageJson(): Promise<Record<
  string,
  any
> | null> {
  // Get the current working directory (where the CLI is being run)
  const cwd = process.cwd();
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

export async function getPackageJson(): Promise<Record<string, any>> {
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
export async function updatePackageJson(packageJson: Record<string, any>) {
  try {
    await fs.promises.writeFile(
      path.join(process.cwd(), 'package.json'),
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
