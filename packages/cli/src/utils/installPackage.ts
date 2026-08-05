import chalk from 'chalk';
import { spawn } from 'child_process';
import fs from 'node:fs';
import path from 'node:path';
import YAML from 'yaml';
import { logger } from '../console/logger.js';
import { PackageManager } from './packageManager.js';

const PNPM_GT_BUILD_DEPENDENCY = 'tree-sitter-python';

function getPackageInstallFlags(
  packageName: string,
  packageManager: PackageManager,
  cwd: string
): string[] {
  if (packageName !== 'gt' || packageManager.id !== 'pnpm') {
    return [];
  }

  const workspaceConfigPath = path.join(cwd, 'pnpm-workspace.yaml');
  if (!fs.existsSync(workspaceConfigPath)) {
    return [];
  }

  try {
    const workspaceConfig = YAML.parse(
      fs.readFileSync(workspaceConfigPath, 'utf8')
    ) as { allowBuilds?: unknown };
    const allowBuilds = workspaceConfig?.allowBuilds;
    if (
      !allowBuilds ||
      typeof allowBuilds !== 'object' ||
      Array.isArray(allowBuilds)
    ) {
      return [];
    }

    const buildDecision = (allowBuilds as Record<string, unknown>)[
      PNPM_GT_BUILD_DEPENDENCY
    ];
    if (typeof buildDecision === 'boolean') {
      return [];
    }

    // GT's Python extractor depends on this package, which declares an install
    // script. pnpm's allowBuilds policy requires an explicit decision for it.
    return [`--allow-build=${PNPM_GT_BUILD_DEPENDENCY}`];
  } catch {
    return [];
  }
}

export async function installPackage(
  packageName: string,
  packageManager: PackageManager,
  asDevDependency?: boolean,
  cwd: string = process.cwd()
): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    const command = packageManager.name;
    const args = [packageManager.installCommand, packageName];

    if (asDevDependency) {
      args.push(packageManager.devDependencyFlag);
    }

    args.push(
      ...packageManager.flags,
      ...getPackageInstallFlags(packageName, packageManager, cwd)
    );

    const childProcess = spawn(command, args, {
      stdio: ['pipe', 'ignore', 'pipe'],
      cwd,
    });

    let errorOutput = '';
    if (childProcess.stderr) {
      childProcess.stderr.on('data', (data) => {
        errorOutput += data.toString();
      });
    }

    childProcess.on('error', (error) => {
      logger.error(chalk.red(`Installation error: ${error.message}`));
      logger.info(
        `Manually install ${packageName} with: ${packageManager.name} ${packageManager.installCommand} ${packageName}`
      );
      reject(error);
    });

    childProcess.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        logger.error(chalk.red(`Installation failed with exit code ${code}`));
        if (errorOutput) {
          logger.error(chalk.red(`Error details: ${errorOutput}`));
        }
        logger.info(
          `Manually install ${packageName} with: ${packageManager.name} ${packageManager.installCommand} ${packageName}`
        );
        reject(new Error(`Process exited with code ${code}`));
      }
    });
  });
}

export async function installPackageGlobal(
  packageName: string,
  version?: string
): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    const command = 'npm';
    const args = [
      'install',
      '-g',
      version ? `${packageName}@${version}` : packageName,
    ];

    const childProcess = spawn(command, args, {
      stdio: ['pipe', 'ignore', 'pipe'],
    });

    let errorOutput = '';
    if (childProcess.stderr) {
      childProcess.stderr.on('data', (data) => {
        errorOutput += data.toString();
      });
    }

    childProcess.on('error', (error) => {
      logger.error(chalk.red(`Installation error: ${error.message}`));
      logger.info(
        `Manually install ${packageName} with: npm install -g ${packageName}`
      );
      reject(error);
    });

    childProcess.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        logger.error(chalk.red(`Installation failed with exit code ${code}`));
        if (errorOutput) {
          logger.error(chalk.red(`Error details: ${errorOutput}`));
        }
        logger.info(
          `Manually install ${packageName} with: npm install -g ${packageName}`
        );
        reject(new Error(`Process exited with code ${code}`));
      }
    });
  });
}
