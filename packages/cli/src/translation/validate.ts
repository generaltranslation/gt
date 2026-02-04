import { exitSync, stripAnsi } from '../console/logging.js';
import { errorCollector } from '../console/errorCollector.js';
import chalk from 'chalk';
import findFilepath from '../fs/findFilepath.js';
import { Options, Settings } from '../types/index.js';
import { logger } from '../console/logger.js';

import { createUpdates } from './parse.js';
import { createInlineUpdates } from '../react/parse/createInlineUpdates.js';

/**
 * Parse file path from error string in withLocation format: "filepath (line:col): message"
 * Returns { file, message } or just { message } if no file found
 */
function parseFileFromError(error: string): { file?: string; message: string } {
  // First try to match with location format: "filepath (line:col): message"
  // Use greedy match for filepath to handle Windows drive letters (C:\...)
  const withLocation = error.match(/^(.+)\s+\(\d+:\d+\)\s*:\s*(.+)$/s);
  if (withLocation) {
    return { file: withLocation[1].trim(), message: withLocation[2].trim() };
  }

  // Fallback: find the last ": " pattern (colon followed by space)
  // This handles Windows paths like "C:\path\file.ts: message"
  const lastColonSpace = error.lastIndexOf(': ');
  if (lastColonSpace > 0) {
    return {
      file: error.substring(0, lastColonSpace).trim(),
      message: error.substring(lastColonSpace + 2).trim(),
    };
  }

  return { message: error };
}

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
      // Add each error to collector with parsed file info
      for (const error of errors) {
        const { file, message } = parseFileFromError(stripAnsi(error));
        if (file) {
          errorCollector.addFileError(file, message);
        } else {
          errorCollector.addError(message);
        }
      }

      // Display formatted error and exit
      logger.error(
        chalk.red(
          `Error: CLI tool encountered ${errors.length} syntax errors:\n` +
            errors
              .map((error) => chalk.red('• ') + chalk.white(error) + '\n')
              .join('')
        )
      );
      return exitSync(1);
    }
    logger.success(
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
    logger.warn(
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
    // Add each error to collector with parsed file info
    for (const error of errors) {
      const { file, message } = parseFileFromError(stripAnsi(error));
      if (file) {
        errorCollector.addFileError(file, message);
      } else {
        errorCollector.addError(message);
      }
    }

    // Display formatted error and exit
    logger.error(
      chalk.red(
        `Error: CLI tool encountered ${errors.length} syntax errors while scanning for translatable content.\n` +
          errors
            .map((error) => chalk.red('• ') + chalk.white(error) + '\n')
            .join('')
      )
    );
    return exitSync(1);
  }

  if (updates.length === 0) {
    logger.error(
      chalk.red(
        `No in-line content or dictionaries were found for ${chalk.green(
          pkg
        )}. Are you sure you're running this command in the right directory?`
      )
    );
  } else {
    logger.success(
      chalk.green(
        `Success! Found ${updates.length} translatable entries for ${chalk.green(
          pkg
        )}.`
      )
    );
  }
}
