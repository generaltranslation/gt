import chalk from 'chalk';
import { spawn } from 'node:child_process';
import { logger } from '../logging/logger.js';

// Utility function for executing a command and returning the output (and error)
// If pipeStdout is true, the output will be logged to the console
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

      let stdOutOutput = '';
      let stdErrOutput = '';

      const timeout = global.setTimeout(() => {
        abortController.abort();
        reject(new Error(`Process timed out after ${timeoutMs / 1000}s`));
      }, timeoutMs);

      childProcess.stderr.on('data', (data) => {
        stdErrOutput += data.toString();
      });

      childProcess.stdout.on('data', (data) => {
        const output = data.toString();
        stdOutOutput += output;
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
          resolve({ stdout: stdOutOutput, stderr: stdErrOutput, code });
        } else {
          logger.log(
            chalk.red(
              `${command} ${args.join(' ')} failed with exit code ${code} in ${cwd}`
            )
          );
          if (stdErrOutput) {
            logger.log(chalk.red(`Error details: ${stdErrOutput}`));
          }
          // reject with the most recent output
          resolve({
            stdout: stdOutOutput,
            stderr: stdErrOutput,
            code: code ?? 1,
          });
        }
      });
    }
  );
}
