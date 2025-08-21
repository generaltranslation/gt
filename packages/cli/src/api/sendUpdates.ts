import chalk from 'chalk';
import {
  createSpinner,
  logMessage,
  logSuccess,
  logWarning,
} from '../console/logging.js';
import {
  Settings,
  SupportedLibraries,
  TranslateFlags,
  Updates,
} from '../types/index.js';
import updateConfig from '../fs/config/updateConfig.js';
import { isUsingLocalTranslations } from '../config/utils.js';
import { gt } from '../utils/gt.js';

export type SendUpdatesResult = {
  versionId: string;
  locales: string[];
};

/**
 * Sends updates to the API
 */
export async function sendUpdates(
  updates: Updates,
  options: TranslateFlags,
  settings: Settings,
  library: SupportedLibraries,
  stage: boolean
): Promise<SendUpdatesResult> {
  const spinner = createSpinner('dots');
  spinner.start(`Sending ${library} updates to General Translation API...`);

  try {
    const responseData = await gt.enqueueEntries(updates, {
      sourceLocale: settings.defaultLocale,
      targetLocales: settings.locales,
      version: settings.version,
      requireApproval: stage,
      modelProvider: settings.modelProvider,
      // publish: settings.publish,
    });

    const { versionId, message, locales, projectSettings } = responseData;

    spinner.stop(chalk.green('Sent updates'));
    logSuccess(message);

    if (isUsingLocalTranslations(settings) && projectSettings.cdnEnabled) {
      logWarning(
        chalk.yellow(
          'Your project is configured to use the CDN, but you are also using local translations. Please disable one or the other.'
        )
      );
    } else if (
      !isUsingLocalTranslations(settings) &&
      !projectSettings.cdnEnabled
    ) {
      logWarning(
        chalk.yellow(
          'Your project is not using the CDN, nor are you using local translations. Please enable one or the other.'
        )
      );
    }

    return { versionId, locales };
  } catch (error) {
    spinner.stop(chalk.red('Failed to send updates'));
    throw error;
  }
}
