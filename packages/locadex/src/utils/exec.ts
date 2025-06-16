import chalk from 'chalk';
import { spawn } from 'node:child_process';
import { logger } from '../logging/logger.js';

export async function execFunction(
  command: string,
  args: string[],
  pipeStdout: boolean = true,
  cwd: string = process.cwd()
): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    const childProcess = spawn(command, args, {
      stdio: ['ignore', 'pipe', 'pipe'],
      cwd,
    });

    let errorOutput = '';

    if (childProcess.stderr) {
      childProcess.stderr.on('data', (data) => {
        errorOutput += data.toString();
      });
    }

    childProcess.stdout.on('data', (data) => {
      if (!pipeStdout) {
        logger.debugMessage(data.toString());
      } else {
        // eslint-disable-next-line no-console
        console.log(data.toString());
      }
    });

    childProcess.on('error', (error) => {
      logger.error(chalk.red(`${command} error: ${error.message}`));
      reject(error);
    });

    childProcess.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        logger.error(chalk.red(`${command} failed with exit code ${code}`));
        if (errorOutput) {
          logger.debugMessage(chalk.red(`Error details: ${errorOutput}`));
        }
        reject(new Error(`Process exited with code ${code}`));
      }
    });
  });
}
