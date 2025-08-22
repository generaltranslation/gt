import { logErrorAndExit } from '../console/logging.js';
import chalk from 'chalk';

import findFilepath from '../fs/findFilepath.js';
import { Settings, TranslateFlags, Updates } from '../types/index.js';
import { logWarning, logError } from '../console/logging.js';

import { createUpdates } from './parse.js';

export async function aggregateReactTranslations(
  options: TranslateFlags,
  settings: Settings,
  library: 'gt-react' | 'gt-next'
): Promise<Updates> {
  if (!options.dictionary) {
    options.dictionary = findFilepath([
      './dictionary.js',
      './src/dictionary.js',
      './dictionary.json',
      './src/dictionary.json',
      './dictionary.ts',
      './src/dictionary.ts',
    ]);
  }

  // ---- CREATING UPDATES ---- //
  const { updates, errors, warnings } = await createUpdates(
    options,
    options.dictionary,
    library,
    false
  );

  if (warnings.length > 0) {
    logWarning(
      chalk.yellow(
        `CLI tool encountered ${warnings.length} warnings while scanning for translatable content.\n` +
          warnings
            .map(
              (warning) => chalk.yellow('• Warning: ') + chalk.white(warning)
            )
            .join('\n')
      )
    );
  }

  if (errors.length > 0) {
    if (options.ignoreErrors) {
      logWarning(
        chalk.yellow(
          `Warning: CLI tool encountered ${errors.length} syntax errors while scanning for translatable content. These components will not be translated.\n` +
            errors
              .map((error) => chalk.yellow('• ') + chalk.white(error) + '\n')
              .join('')
        )
      );
    } else {
      logErrorAndExit(
        chalk.red(
          `Error: CLI tool encountered ${errors.length} syntax errors while scanning for translatable content. ${chalk.gray('To ignore these errors, re-run with --ignore-errors')}\n` +
            errors
              .map((error) => chalk.red('• ') + chalk.white(error) + '\n')
              .join('')
        )
      );
    }
  }

  if (updates.length == 0) {
    logError(
      chalk.red(
        `No in-line content or dictionaries were found for ${chalk.green(
          library
        )}. Are you sure you're running this command in the right directory?`
      )
    );
    return updates;
  }

  return updates;
}
