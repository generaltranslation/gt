import fs from 'node:fs';
import { spawn } from 'node:child_process';
import chalk from 'chalk';
import { logMessage, logWarning } from '../console/logging.js';

type Formatter = 'prettier' | 'biome' | 'eslint';

export async function detectFormatter(): Promise<Formatter | null> {
  // Try Prettier
  try {
    await import('prettier');
    return 'prettier';
  } catch {}

  // Try ESLint
  try {
    await import('eslint');
    return 'eslint';
  } catch {}

  // Try Biome
  try {
    return await new Promise<Formatter | null>((resolve, reject) => {
      const child = spawn('npx', ['@biomejs/biome', '--version'], {
        stdio: 'ignore',
      });

      child.on('error', () => {
        resolve(null);
      });

      child.on('close', (code: number) => {
        if (code === 0) {
          resolve('biome');
        } else {
          resolve(null);
        }
      });
    });
  } catch {}

  return null;
}

export async function formatFiles(
  filesUpdated: string[],
  formatter?: Formatter
): Promise<void> {
  if (filesUpdated.length === 0) return;

  try {
    const detectedFormatter = formatter || (await detectFormatter());

    if (!detectedFormatter) {
      logWarning(chalk.yellow('No supported formatter detected'));
      return;
    }

    if (detectedFormatter === 'prettier') {
      logMessage(chalk.dim('Cleaning up with prettier...'));
      const prettier = await import('prettier');
      for (const file of filesUpdated) {
        const config = await prettier.resolveConfig(file);
        const content = await fs.promises.readFile(file, 'utf-8');
        const formatted = await prettier.format(content, {
          ...config,
          filepath: file,
        });
        await fs.promises.writeFile(file, formatted);
      }
      return;
    }

    if (detectedFormatter === 'biome') {
      logMessage(chalk.dim('Cleaning up with biome...'));
      try {
        await new Promise<void>((resolve, reject) => {
          const args = [
            '@biomejs/biome',
            'format',
            '--write',
            ...filesUpdated.map((file) => file),
          ];

          const child = spawn('npx', args, {
            stdio: ['ignore', 'inherit', 'inherit'],
          });

          child.on('error', (error: Error) => {
            logWarning(
              chalk.yellow('Biome formatting failed: ' + error.message)
            );
            resolve();
          });

          child.on('close', (code: number) => {
            if (code !== 0) {
              logWarning(
                chalk.yellow(`Biome formatting failed with exit code ${code}`)
              );
            }
            resolve();
          });
        });
      } catch (error) {
        logWarning(chalk.yellow('Biome formatting failed: ' + String(error)));
      }
      return;
    }

    if (detectedFormatter === 'eslint') {
      logMessage(chalk.dim('Cleaning up with eslint...'));
      const { ESLint } = await import('eslint');
      const eslint = new ESLint({
        fix: true,
        overrideConfigFile: undefined, // Will use project's .eslintrc
      });
      for (const file of filesUpdated) {
        const results = await eslint.lintFiles([file]);
        await ESLint.outputFixes(results);
      }
      return;
    }
  } catch (e) {
    logWarning(chalk.yellow('Unable to run code formatter: ' + String(e)));
  }
}
