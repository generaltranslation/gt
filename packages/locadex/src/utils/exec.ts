import chalk from 'chalk';
import { spawn } from 'node:child_process';
import { logger } from '../logging/logger.js';

export async function execFunction(
  command: string,
  args: string[],
  pipeStdout: boolean = true,
  cwd: string = process.cwd(),
  parentAbortController?: AbortController,
  timeoutMs: number = 5 * 60 * 1000
): Promise<{ stdout: string; stderr: string; code: number }> {
  return new Promise<{ stdout: string; stderr: string; code: number }>(
    (resolve, reject) => {
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

      let stdoutOutput = '';
      let errorOutput = '';

      const timeout = global.setTimeout(() => {
        abortController.abort();
        reject(new Error(`Process timed out after ${timeoutMs / 1000}s`));
      }, timeoutMs);

      if (childProcess.stderr) {
        childProcess.stderr.on('data', (data) => {
          errorOutput += data.toString();
        });
      }

      childProcess.stdout.on('data', (data) => {
        const output = data.toString();
        stdoutOutput += output;
        if (!pipeStdout) {
          logger.log(output);
        } else {
          // eslint-disable-next-line no-console
          console.log(output);
        }
      });

      childProcess.on('error', (error) => {
        global.clearTimeout(timeout);
        reject(error);
      });

      childProcess.on('close', (code) => {
        global.clearTimeout(timeout);
        if (code === 0) {
          resolve({ stdout: stdoutOutput, stderr: errorOutput, code });
        } else {
          logger.log(chalk.red(`${command} failed with exit code ${code}`));
          if (errorOutput) {
            logger.log(chalk.red(`Error details: ${errorOutput}`));
          }
          // reject with the most recent output
          resolve({
            stdout: stdoutOutput,
            stderr: errorOutput,
            code: code ?? 1,
          });
        }
      });
    }
  );
}
