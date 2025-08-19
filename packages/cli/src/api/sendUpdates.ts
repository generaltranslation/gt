import chalk from 'chalk';
import {
  createSpinner,
  logMessage,
  logSuccess,
  logWarning,
} from '../console/logging.js';
import { Settings, SupportedLibraries, Updates } from '../types/index.js';
import updateConfig from '../fs/config/updateConfig.js';
import { DataFormat } from '../types/data.js';
import { isUsingLocalTranslations } from '../config/utils.js';
import { gt } from '../utils/gt.js';

export type ApiOptions = Settings & {
  timeout: string;
  dataFormat: DataFormat;
  description?: string;
  requireApproval?: boolean;
};

export type SendUpdatesResult = {
  versionId: string;
  locales: string[];
};

/**
 * Sends updates to the API
 * @param updates - The updates to send
 * @param options - The options for the API call
 * @returns The versionId of the updated project
 */
export async function sendUpdates(
  updates: Updates,
  options: ApiOptions,
  library: SupportedLibraries
): Promise<SendUpdatesResult> {
  const spinner = createSpinner('dots');
  spinner.start(`Sending ${library} updates to General Translation API...`);

  try {
    const responseData = await gt.enqueueEntries(updates, {
      sourceLocale: options.defaultLocale,
      targetLocales: options.locales,
      dataFormat: options.dataFormat,
      version: options.version,
      description: options.description,
      requireApproval: options.requireApproval,
      modelProvider: options.modelProvider,
    });

    const { versionId, message, locales, projectSettings } = responseData;

    spinner.stop(chalk.green('Sent updates'));
    logSuccess(message);

    if (isUsingLocalTranslations(options) && projectSettings.cdnEnabled) {
      logWarning(
        chalk.yellow(
          'Your project is configured to use the CDN, but you are also using local translations. Please disable one or the other.'
        )
      );
    } else if (
      !isUsingLocalTranslations(options) &&
      !projectSettings.cdnEnabled
    ) {
      logWarning(
        chalk.yellow(
          'Your project is not using the CDN, nor are you using local translations. Please enable one or the other.'
        )
      );
    }

    if (options.config) {
      await updateConfig({
        configFilepath: options.config,
        _versionId: versionId,
        locales,
      });
    }

    return { versionId, locales };
  } catch (error) {
    spinner.stop(chalk.red('Failed to send updates'));
    throw error;
  }
}
