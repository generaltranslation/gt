import chalk from 'chalk';
import { spawn } from 'child_process';
import { logError, logInfo } from '../console/logging.js';
import { PackageManager } from './packageManager.js';

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
      logError(chalk.red(`Installation error: ${error.message}`));
      logInfo(
        `Please manually install ${packageName} with: ${packageManager.name} ${packageManager.installCommand} ${packageName}`
      );
      reject(error);
    });

    childProcess.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        logError(chalk.red(`Installation failed with exit code ${code}`));
        if (errorOutput) {
          logError(chalk.red(`Error details: ${errorOutput}`));
        }
        logInfo(
          `Please manually install ${packageName} with: ${packageManager.name} ${packageManager.installCommand} ${packageName}`
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
      logError(chalk.red(`Installation error: ${error.message}`));
      logInfo(
        `Please manually install ${packageName} with: npm install -g ${packageName}`
      );
      reject(error);
    });

    childProcess.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        logError(chalk.red(`Installation failed with exit code ${code}`));
        if (errorOutput) {
          logError(chalk.red(`Error details: ${errorOutput}`));
        }
        logInfo(
          `Please manually install ${packageName} with: npm install -g ${packageName}`
        );
        reject(new Error(`Process exited with code ${code}`));
      }
    });
  });
}
