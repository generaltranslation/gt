import chalk from 'chalk';
import { spawn } from 'child_process';
import fs from 'node:fs';
import path from 'node:path';
import { stripVTControlCharacters } from 'node:util';
import { createDiagnosticMessage } from 'generaltranslation/internal';
import { logger } from '../console/logger.js';
import { PackageManager, PNPM } from './packageManager.js';
import { getPackageJson, isPackageInstalled } from './packageJson.js';

/** pnpm 11 exits 1 after installing when it skipped unapproved build scripts. */
const PNPM_IGNORED_BUILDS_PATTERN =
  /^\[ERR_PNPM_IGNORED_BUILDS\] Ignored build scripts: (.+)$/m;

/** Any other pnpm error or a failed lifecycle script is a real install failure. */
const PNPM_OTHER_FAILURE_PATTERN =
  /ERR_PNPM_(?!IGNORED_BUILDS\b)|ELIFECYCLE|: Failed$/m;

/**
 * Names from `esbuild@0.27.7, @scope/pkg@1.0.0`, without versions. Empty unless
 * pnpm's only failure is its top-level ignored-builds error.
 */
function getPnpmIgnoredBuilds(
  packageManager: PackageManager,
  rawOutput: string
): string[] {
  if (packageManager.id !== PNPM.id) return [];
  // FORCE_COLOR=1 makes pnpm color the error code and message separately.
  const output = stripVTControlCharacters(rawOutput);
  if (PNPM_OTHER_FAILURE_PATTERN.test(output)) return [];
  const match = output.match(PNPM_IGNORED_BUILDS_PATTERN);
  if (!match) return [];
  return match[1]
    .split(',')
    .map((spec) => spec.trim().replace(/(?<=.)@[^@]*$/, ''))
    .filter(Boolean);
}

async function wasPackageInstalled(
  packageName: string,
  asDevDependency: boolean,
  cwd: string
): Promise<boolean> {
  const packageJson = await getPackageJson(cwd);
  return (
    !!packageJson &&
    isPackageInstalled(packageName, packageJson, asDevDependency) &&
    fs.existsSync(path.join(cwd, 'node_modules', packageName, 'package.json'))
  );
}

function pnpmIgnoredBuildsWarning(
  packageName: string,
  ignoredBuilds: string[]
): string {
  return createDiagnosticMessage({
    source: 'gt',
    severity: 'Warning',
    whatHappened: `pnpm skipped the build scripts of ${ignoredBuilds.join(', ')}`,
    why: 'they are not approved, and later or fresh `pnpm install` runs may fail until you allow or deny them',
    reassurance: `${packageName} was installed, so setup will continue`,
    fix: `Add ${ignoredBuilds.map((name) => `\`${JSON.stringify(name)}: false\``).join(', ')} under \`allowBuilds\` in pnpm-workspace.yaml, or run \`pnpm approve-builds\``,
  });
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

    const childProcess = spawn(command, args, {
      stdio: ['pipe', 'pipe', 'pipe'],
      cwd,
    });

    // pnpm prints ERR_PNPM_* errors to stdout.
    let output = '';
    childProcess.stdout?.on('data', (data) => {
      output += data.toString();
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

    childProcess.on('close', async (code) => {
      if (code === 0) {
        resolve();
      } else {
        const ignoredBuilds = getPnpmIgnoredBuilds(
          packageManager,
          output + errorOutput
        );
        if (
          ignoredBuilds.length > 0 &&
          (await wasPackageInstalled(packageName, !!asDevDependency, cwd))
        ) {
          logger.warn(pnpmIgnoredBuildsWarning(packageName, ignoredBuilds));
          resolve();
          return;
        }
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
