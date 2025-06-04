import { devApiKeyError, logErrorAndExit } from '../console/errors';
import chalk from 'chalk';

import findFilepath from '../fs/findFilepath';
import { Options, Settings, SupportedLibraries } from '../types';
import { logSuccess, logWarning, logError } from '../console/logging';

import { createUpdates } from './parse';
import {
  noLocalesError,
  noDefaultLocaleError,
  noProjectIdError,
  noApiKeyError,
} from '../console/errors';
import { sendUpdates } from '../api/sendUpdates';

export async function stageProject(
  settings: Options & Settings,
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

  // Separate defaultLocale from locales
  settings.locales = settings.locales.filter(
    (locale) => locale !== settings.defaultLocale
  );

  // validate timeout
  const timeout = parseInt(settings.timeout);
  if (isNaN(timeout) || timeout < 0) {
    logErrorAndExit(
      `Invalid timeout: ${settings.timeout}. Must be a positive integer.`
    );
  }
  settings.timeout = timeout.toString();

  // ---- CREATING UPDATES ---- //
  const { updates, errors } = await createUpdates(
    settings,
    settings.dictionary,
    pkg
  );

  if (errors.length > 0) {
    if (settings.ignoreErrors) {
      logWarning(
        chalk.yellow(
          `Warning: CLI tool encountered syntax errors while scanning for translatable content. These components will not be translated.\n` +
            errors
              .map((error) => chalk.yellow('• ') + chalk.white(error) + '\n')
              .join('')
        )
      );
    } else {
      logErrorAndExit(
        chalk.red(
          `Error: CLI tool encountered syntax errors while scanning for translatable content. ${chalk.dim('To ignore these errors, re-run with --ignore-errors')}\n` +
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
