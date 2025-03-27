import chalk from 'chalk';
import { displayLoadingAnimation } from '../console/console';
import { Settings, SupportedLibraries, Updates } from '../types';
import updateConfig from '../fs/config/updateConfig';
import { waitForUpdates } from './waitForUpdates';
import { DataFormat } from '../types/data';

type ApiOptions = Settings & {
  publish: boolean;
  wait: boolean;
  timeout: string;
  dataFormat: DataFormat;
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
) {
  const { apiKey, projectId, defaultLocale, dataFormat } = options;

  const globalMetadata = {
    ...(projectId && { projectId }),
    ...(defaultLocale && { sourceLocale: defaultLocale }),
  };

  // If additionalLocales is provided, additionalLocales + project.current_locales will be translated
  // If not, then options.locales will be translated
  // If neither, then project.current_locales will be translated
  const body = {
    updates,
    ...(options.locales && { locales: options.locales }),
    metadata: globalMetadata,
    publish: options.publish,
    ...(dataFormat && { dataFormat }),
    ...(options.versionId && { versionId: options.versionId }),
  };

  console.log();
  const spinner = await displayLoadingAnimation(
    `Sending ${library} updates to General Translation API...`
  );

  try {
    const startTime = Date.now();
    const response = await fetch(
      `${options.baseUrl}/v1/project/translations/update`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(apiKey && { 'x-gt-api-key': apiKey }),
        },
        body: JSON.stringify(body),
      }
    );

    process.stdout.write('\n\n');

    if (!response.ok) {
      spinner.fail(await response.text());
      process.exit(1);
    }

    if (response.status === 204) {
      spinner.succeed(await response.text());
      return;
    }

    const { versionId, message, locales } = await response.json();
    spinner.succeed(chalk.green(message));
    if (options.config)
      updateConfig({
        configFilepath: options.config,
        _versionId: versionId,
        locales,
      });

    // Wait for translations if wait is true
    if (options.wait && locales) {
      // timeout was validated earlier
      const timeout = parseInt(options.timeout) * 1000;
      await waitForUpdates(
        apiKey,
        options.baseUrl,
        versionId,
        locales,
        startTime,
        timeout
      );
    }
    return { versionId };
  } catch (error) {
    spinner.fail(chalk.red('Failed to send updates'));
    throw error;
  }
}
