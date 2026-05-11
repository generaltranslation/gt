import { logger } from '../console/logger.js';

import chalk from 'chalk';
import path from 'node:path';
import fs from 'node:fs';
import { exitSync } from '../console/logging.js';
import { PACKAGE_VERSION } from '../generated/version.js';

// search for package.json such that we can run init in non-js projects
export async function searchForPackageJson(
  cwd: string = process.cwd()
): Promise<Record<string, unknown> | null> {
  // Get the current working directory (where the CLI is being run)
  const packageJsonPath = path.join(cwd, 'package.json');

  // Check if package.json exists
  if (!fs.existsSync(packageJsonPath)) {
    return null;
  }
  try {
    return JSON.parse(await fs.promises.readFile(packageJsonPath, 'utf8'));
  } catch {
    return null;
  }
}

export async function getPackageJson(
  cwd: string = process.cwd()
): Promise<Record<string, unknown> | null> {
  const packageJsonPath = path.join(cwd, 'package.json');

  // Check if package.json exists
  if (!fs.existsSync(packageJsonPath)) {
    return null;
  }
  try {
    return JSON.parse(await fs.promises.readFile(packageJsonPath, 'utf8'));
  } catch {
    return null;
  }
}

export function getCLIVersion(): string {
  return PACKAGE_VERSION;
}

export async function updatePackageJson(
  packageJson: Record<string, unknown>,
  cwd: string = process.cwd()
) {
  try {
    await fs.promises.writeFile(
      path.join(cwd, 'package.json'),
      JSON.stringify(packageJson, null, 2)
    );
  } catch (error) {
    logger.error(chalk.red('Error updating package.json: ' + String(error)));
    exitSync(1);
  }
}

// check if a package is installed in the package.json file
export function isPackageInstalled(
  packageName: string,
  packageJson: Record<string, unknown>,
  asDevDependency: boolean = false,
  checkBoth: boolean = false
): boolean {
  const devDependencies =
    (packageJson.devDependencies as Record<string, string> | undefined) ?? {};
  const prodDependencies =
    (packageJson.dependencies as Record<string, string> | undefined) ?? {};
  const dependencies = checkBoth
    ? {
        ...devDependencies,
        ...prodDependencies,
      }
    : asDevDependency
      ? devDependencies
      : prodDependencies;

  if (!dependencies) {
    return false;
  }
  return dependencies[packageName] !== undefined;
}

export function getPackageVersion(
  packageName: string,
  packageJson: Record<string, unknown>
): string | undefined {
  const devDependencies =
    (packageJson.devDependencies as Record<string, string> | undefined) ?? {};
  const prodDependencies =
    (packageJson.dependencies as Record<string, string> | undefined) ?? {};
  const dependencies = {
    ...prodDependencies,
    ...devDependencies,
  };
  return dependencies[packageName] ?? undefined;
}
