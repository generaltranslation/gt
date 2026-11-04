import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import chalk from 'chalk';
import { createDiagnosticMessage } from 'generaltranslation/internal';
import { logger } from '../console/logger.js';

export type Formatter = 'prettier' | 'biome' | 'eslint';

/**
 * Finds the project's installed Biome entry point, a Node.js script, searching
 * node_modules from cwd upward like Node resolution, so a monorepo root install
 * is found too.
 */
export function findLocalBiome(cwd: string = process.cwd()): string | null {
  let dir = path.resolve(cwd);
  while (true) {
    const bin = path.join(
      dir,
      'node_modules',
      '@biomejs',
      'biome',
      'bin',
      'biome'
    );
    if (fs.existsSync(bin)) return bin;
    const parent = path.dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
}

/**
 * The Node.js executable that runs Biome's entry point. In the standalone
 * binary, process.execPath is the gt binary itself, so use node from PATH.
 */
function nodeExecutable(): string {
  return process.versions.bun ? 'node' : process.execPath;
}

export async function detectFormatter(): Promise<Formatter | null> {
  // Try Prettier
  try {
    await import('prettier');
    return 'prettier';
  } catch {
    // Prettier is optional.
  }

  // Try ESLint
  try {
    await import('eslint');
    return 'eslint';
  } catch {
    // ESLint is optional.
  }

  // Try Biome, only if the project has it installed. Never download it.
  if (findLocalBiome()) return 'biome';

  return null;
}

const biomeNotInstalledWarning = createDiagnosticMessage({
  source: 'gt',
  severity: 'Warning',
  whatHappened: 'Could not format the files changed by setup with Biome',
  reassurance: 'Setup finished; only formatting was skipped',
  details: '@biomejs/biome is not installed in this project',
  fix: 'Install @biomejs/biome, or run your formatter on the changed files',
});

export async function formatFiles(
  filesUpdated: string[],
  formatter?: Formatter
): Promise<void> {
  if (filesUpdated.length === 0) return;

  try {
    const detectedFormatter = formatter || (await detectFormatter());

    if (!detectedFormatter) {
      logger.warn(chalk.yellow('No supported formatter detected'));
      return;
    }

    if (detectedFormatter === 'prettier') {
      logger.message(chalk.dim('Cleaning up with prettier...'));
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
      const biome = findLocalBiome();
      if (!biome) {
        logger.warn(biomeNotInstalledWarning);
        return;
      }
      logger.message(chalk.dim('Cleaning up with biome...'));
      try {
        await new Promise<void>((resolve) => {
          const args = [biome, 'format', '--write', ...filesUpdated];

          // Formatter output is diagnostics; keep stdout free for commands' data.
          // Running the script with Node works on every OS, unlike .bin shims.
          const child = spawn(nodeExecutable(), args, {
            stdio: ['ignore', process.stderr, 'inherit'],
          });

          child.on('error', (error: Error) => {
            logger.warn(
              chalk.yellow('Biome formatting failed: ' + error.message)
            );
            resolve();
          });

          child.on('close', (code: number) => {
            if (code !== 0) {
              logger.warn(
                chalk.yellow(`Biome formatting failed with exit code ${code}`)
              );
            }
            resolve();
          });
        });
      } catch (error) {
        logger.warn(chalk.yellow('Biome formatting failed: ' + String(error)));
      }
      return;
    }

    if (detectedFormatter === 'eslint') {
      logger.message(chalk.dim('Cleaning up with eslint...'));
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
    logger.warn(chalk.yellow('Unable to run code formatter: ' + String(e)));
  }
}
