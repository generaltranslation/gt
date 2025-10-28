import { logErrorAndExit, logWarning } from '../console/logging.js';
import chalk from 'chalk';
import findFilepath from '../fs/findFilepath.js';
import { Options, Settings } from '../types/index.js';
import { logError, logSuccess } from '../console/logging.js';

import { createUpdates } from './parse.js';
import { createInlineUpdates } from '../react/parse/createInlineUpdates.js';

export async function validateProject(
  settings: Options & Settings,
  pkg: 'gt-react' | 'gt-next',
  files?: string[]
): Promise<void> {
  if (files && files.length > 0) {
    // Validate specific files using createInlineUpdates
    const { errors, updates } = await createInlineUpdates(
      pkg,
      true,
      files,
      settings.parsingOptions
    );

    if (errors.length > 0) {
      logErrorAndExit(
        chalk.red(
          `Error: CLI tool encountered ${errors.length} syntax errors:\n` +
            errors
              .map((error) => chalk.red('• ') + chalk.white(error) + '\n')
              .join('')
        )
      );
    }
    logSuccess(
      chalk.green(`Success! Found ${updates.length} translatable entries.`)
    );
    return;
  }

  if (!settings.dictionary) {
    settings.dictionary = findFilepath([
      './dictionary.js',
      './src/dictionary.js',
      './dictionary.json',
      './src/dictionary.json',
      './dictionary.ts',
      './src/dictionary.ts',
    ]);
  }

  const { updates, errors, warnings } = await createUpdates(
    settings,
    settings.src,
    settings.dictionary,
    pkg,
    true,
    settings.parsingOptions
  );

  if (warnings.length > 0) {
    logWarning(
      chalk.yellow(
        `CLI tool encountered ${warnings.length} warnings while scanning for translatable content.`
      ) +
        '\n' +
        warnings
          .map((warning) => chalk.yellow('• ') + chalk.white(warning))
          .join('\n')
    );
  }

  if (errors.length > 0) {
    logErrorAndExit(
      chalk.red(
        `Error: CLI tool encountered ${errors.length} syntax errors while scanning for translatable content.\n` +
          errors
            .map((error) => chalk.red('• ') + chalk.white(error) + '\n')
            .join('')
      )
    );
  }

  if (updates.length === 0) {
    logError(
      chalk.red(
        `No in-line content or dictionaries were found for ${chalk.green(
          pkg
        )}. Are you sure you're running this command in the right directory?`
      )
    );
  } else {
    logSuccess(
      chalk.green(
        `Success! Found ${updates.length} translatable entries for ${chalk.green(
          pkg
        )}.`
      )
    );
  }
}
