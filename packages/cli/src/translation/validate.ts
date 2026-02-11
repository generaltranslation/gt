import { logErrorAndExit, stripAnsi } from '../console/logging.js';
import chalk from 'chalk';
import findFilepath from '../fs/findFilepath.js';
import { Options, Settings, Updates } from '../types/index.js';
import { logger } from '../console/logger.js';

import { createUpdates } from './parse.js';
import { createInlineUpdates } from '../react/parse/createInlineUpdates.js';

// Types for programmatic validation API
export type ValidationLevel = 'error' | 'warning';

export type ValidationMessage = {
  level: ValidationLevel;
  message: string;
};

export type ValidationResult = Record<string, ValidationMessage[]>;

/**
 * Shared validation logic - returns raw results from createUpdates/createInlineUpdates
 */
async function runValidation(
  settings: Options & Settings,
  pkg: 'gt-react' | 'gt-next' | 'gt-node' | 'gt-react-native',
  files?: string[]
): Promise<{ updates: Updates; errors: string[]; warnings: string[] }> {
  if (files && files.length > 0) {
    return createInlineUpdates(pkg, true, files, settings.parsingOptions);
  }

  // Full project validation
  // Use local variable to avoid mutating caller's settings object
  const dictionary =
    settings.dictionary ||
    findFilepath([
      './dictionary.js',
      './src/dictionary.js',
      './dictionary.json',
      './src/dictionary.json',
      './dictionary.ts',
      './src/dictionary.ts',
    ]);

  return createUpdates(
    settings,
    settings.src,
    dictionary,
    pkg,
    true,
    settings.parsingOptions
  );
}

/**
 * Parse file path from error/warning string in withLocation format: "filepath (line:col): message"
 */
function parseFileFromMessage(msg: string): { file: string; message: string } {
  // First try to match with location format: "filepath (line:col): message"
  // Using [\s\S] instead of . with /s flag for ES5 compatibility
  const withLocation = msg.match(/^(.+)\s+\(\d+:\d+\)\s*:\s*([\s\S]+)$/);
  if (withLocation) {
    return { file: withLocation[1].trim(), message: withLocation[2].trim() };
  }

  // Fallback: find the last ": " pattern (handles Windows paths like C:\...)
  const lastColonSpace = msg.lastIndexOf(': ');
  if (lastColonSpace > 0) {
    return {
      file: msg.substring(0, lastColonSpace).trim(),
      message: msg.substring(lastColonSpace + 2).trim(),
    };
  }

  // No file found - use empty string as key for "global" messages
  return { file: '', message: msg };
}

/**
 * Programmatic API for validation - returns structured results instead of logging/exiting.
 * Equivalent to running `gtx-cli validate` but returns data.
 */
export async function getValidateJson(
  settings: Options & Settings,
  pkg: 'gt-react' | 'gt-next' | 'gt-node' | 'gt-react-native',
  files?: string[]
): Promise<ValidationResult> {
  const { errors, warnings } = await runValidation(settings, pkg, files);

  const result: ValidationResult = {};

  const addMessage = (
    file: string,
    level: ValidationLevel,
    message: string
  ) => {
    if (!result[file]) {
      result[file] = [];
    }
    result[file].push({ level, message });
  };

  for (const error of errors) {
    const { file, message } = parseFileFromMessage(stripAnsi(error));
    addMessage(file, 'error', message);
  }
  for (const warning of warnings) {
    const { file, message } = parseFileFromMessage(stripAnsi(warning));
    addMessage(file, 'warning', message);
  }

  return result;
}

export async function validateProject(
  settings: Options & Settings,
  pkg: 'gt-react' | 'gt-next' | 'gt-node' | 'gt-react-native',
  files?: string[]
): Promise<void> {
  const { updates, errors, warnings } = await runValidation(
    settings,
    pkg,
    files
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
