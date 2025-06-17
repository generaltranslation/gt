import chalk from 'chalk';
import { spawn } from 'node:child_process';
import { logger } from '../logging/logger.js';

export async function execFunction(
  command: string,
  args: string[],
  pipeStdout: boolean = true,
  cwd: string = process.cwd(),
  parentAbortController?: AbortController
): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    const abortController = new AbortController();

    // Listen for parent abort signal
    if (parentAbortController) {
      parentAbortController.signal.addEventListener('abort', () => {
        abortController.abort();
        reject(new Error('Process aborted by parent'));
      });
    }

    const childProcess = spawn(command, args, {
      stdio: ['ignore', 'pipe', 'pipe'],
      cwd,
      signal: abortController.signal,
    });

    let errorOutput = '';

    const timeout = global.setTimeout(
      () => {
        abortController.abort();
        reject(new Error(`Process timed out after 5 minutes`));
      },
      5 * 60 * 1000
    );

    if (childProcess.stderr) {
      childProcess.stderr.on('data', (data) => {
        errorOutput = data.toString();
      });
    }

    childProcess.stdout.on('data', (data) => {
      errorOutput = data.toString();
      if (!pipeStdout) {
        logger.log(data.toString());
      } else {
        // eslint-disable-next-line no-console
        console.log(data.toString());
      }
    });

    childProcess.on('error', (error) => {
      global.clearTimeout(timeout);
      reject(error);
    });

    childProcess.on('close', (code) => {
      global.clearTimeout(timeout);
      if (code === 0) {
        resolve();
      } else {
        logger.log(chalk.red(`${command} failed with exit code ${code}`));
        if (errorOutput) {
          logger.log(chalk.red(`Error details: ${errorOutput}`));
        }
        // reject with the most recent output
        reject(new Error(errorOutput));
      }
    });
  });
}
