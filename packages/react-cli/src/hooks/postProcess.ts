import fs from 'fs';
import chalk from 'chalk';

type Formatter = 'prettier' | 'biome' | 'eslint';

export async function detectFormatter(): Promise<Formatter | null> {
  // Try Prettier
  try {
    require('prettier');
    return 'prettier';
  } catch {}

  // Try Biome
  try {
    const { execSync } = require('child_process');
    execSync('npx @biomejs/biome --version', { stdio: 'ignore' });
    return 'biome';
  } catch {}

  // Try ESLint
  try {
    require('eslint');
    return 'eslint';
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
      console.log(chalk.yellow('\n⚠️  No supported formatter detected'));
      return;
    }

    if (detectedFormatter === 'prettier') {
      console.log(chalk.gray('\nCleaning up with prettier...'));
      const prettier = require('prettier');
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
      console.log(chalk.gray('\nCleaning up with biome...'));
      try {
        const { execSync } = require('child_process');
        execSync(
          `npx @biomejs/biome format --write ${filesUpdated.join(' ')}`,
          {
            stdio: ['ignore', 'inherit', 'inherit'],
          }
        );
      } catch (error) {
        console.log(chalk.yellow('\n⚠️  Biome formatting failed'));
        if (error instanceof Error) {
          console.log(chalk.gray(error.message));
        }
      }
      return;
    }

    if (detectedFormatter === 'eslint') {
      console.log(chalk.gray('\nCleaning up with eslint...'));
      const { ESLint } = require('eslint');
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
    console.log(chalk.yellow('\n⚠️  Unable to run code formatter'));
    if (e instanceof Error) {
      console.log(chalk.gray(e.message));
    }
  }
}
