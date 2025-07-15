import chalk from 'chalk';
import { createSpinner, logSuccess, logWarning } from '../console/logging.js';
import { Settings, SupportedLibraries, Updates } from '../types/index.js';
import updateConfig from '../fs/config/updateConfig.js';
import { DataFormat } from '../types/data.js';
import { isUsingLocalTranslations } from '../config/utils.js';
import { gt } from '../utils/gt.js';

type ApiOptions = Settings & {
  timeout: string;
  dataFormat: DataFormat;
  description?: string;
  requireApproval?: boolean;
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
): Promise<{ versionId: string; locales: string[] }> {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars, no-unused-vars
  const { timeout, ...optionsWithoutTimeout } = options;

  const spinner = createSpinner('dots');
  spinner.start(`Sending ${library} updates to General Translation API...`);

  try {
    const responseData = await gt.enqueueEntries(
      updates,
      optionsWithoutTimeout
    );

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
