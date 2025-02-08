import fs from 'fs';
import chalk from 'chalk';

export async function formatFiles(filesUpdated: string[]): Promise<void> {
  if (filesUpdated.length === 0) return;
  try {
    // Try Prettier
    let prettier;
    try {
      prettier = require('prettier');
    } catch {
      prettier = null;
    }

    if (prettier) {
      console.log(chalk.gray('\nCleaning up with prettier...'));
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

    // Try Biome
    let biome;
    try {
      const { execSync } = require('child_process');
      // Check if biome is installed
      execSync('npx @biomejs/biome --version', { stdio: 'ignore' });
      biome = true;
    } catch {
      biome = null;
    }
    if (biome) {
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

    // Try ESLint
    let ESLint;
    try {
      ({ ESLint } = require('eslint'));
    } catch {
      ESLint = null;
    }
    if (ESLint) {
      console.log(chalk.gray('\nCleaning up with eslint...'));
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
