import { devApiKeyError } from '../console/index.js';
import { logErrorAndExit } from '../console/logging.js';
import chalk from 'chalk';

import findFilepath from '../fs/findFilepath.js';
import { Settings, TranslateFlags, Updates } from '../types/index.js';
import { logSuccess, logWarning, logError } from '../console/logging.js';

import { createUpdates } from './parse.js';
import {
  noLocalesError,
  noDefaultLocaleError,
  noProjectIdError,
  noApiKeyError,
} from '../console/index.js';
import { sendUpdates } from '../api/sendUpdates.js';

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

export async function stageProject(
  settings: TranslateFlags,
  pkg: 'gt-react' | 'gt-next'
): Promise<{ versionId: string; locales: string[] } | null> {
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

  // validate timeout
  const timeout = parseInt(settings.timeout);
  if (isNaN(timeout) || timeout < 0) {
    logErrorAndExit(
      `Invalid timeout: ${settings.timeout}. Must be a positive integer.`
    );
  }
  settings.timeout = timeout.toString();

  // ---- CREATING UPDATES ---- //
  const { updates, errors, warnings } = await createUpdates(
    settings,
    settings.dictionary,
    pkg,
    false
  );

  if (warnings.length > 0) {
    if (settings.suppressWarnings) {
      logWarning(
        chalk.yellow(
          `CLI tool encountered ${warnings.length} warnings while scanning for translatable content. ${chalk.gray('To view these warnings, re-run without the --suppress-warnings flag')}`
        )
      );
    } else {
      logWarning(
        chalk.yellow(
          `CLI tool encountered ${warnings.length} warnings while scanning for translatable content. ${chalk.gray('To suppress these warnings, re-run with --suppress-warnings')}\n` +
            warnings
              .map(
                (warning) => chalk.yellow('• Warning: ') + chalk.white(warning)
              )
              .join('\n')
        )
      );
    }
  }

  if (errors.length > 0) {
    if (settings.ignoreErrors) {
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

  if (settings.dryRun) {
    logSuccess('Dry run: No translations were sent to General Translation.');
    return null;
  }

  if (updates.length == 0) {
    logError(
      chalk.red(
        `No in-line content or dictionaries were found for ${chalk.green(
          pkg
        )}. Are you sure you're running this command in the right directory?`
      )
    );
    return null;
  }

  // Send updates to General Translation API
  if (!settings.locales) {
    logErrorAndExit(noLocalesError);
  }
  if (!settings.defaultLocale) {
    logErrorAndExit(noDefaultLocaleError);
  }
  if (!settings.apiKey) {
    logErrorAndExit(noApiKeyError);
  }
  if (settings.apiKey.startsWith('gtx-dev-')) {
    logErrorAndExit(devApiKeyError);
  }
  if (!settings.projectId) {
    logErrorAndExit(noProjectIdError);
  }

  const updateResponse = await sendUpdates(
    updates,
    {
      ...settings,
      timeout: settings.timeout,
      dataFormat: 'JSX',
    },
    pkg
  );
  const { versionId, locales } = updateResponse;
  return { versionId, locales };
}
