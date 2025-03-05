import chalk from 'chalk';
import { displayLoadingAnimation } from '../console/console';
import { Updates } from '../types';
import updateConfig from '../fs/config/updateConfig';
import { waitForUpdates } from './waitForUpdates';
import saveTranslations from '../fs/saveTranslations';
type ApiOptions = {
  baseUrl: string;
  config: string;
  apiKey: string;
  projectId: string;
  defaultLocale: string;
  locales: string[];
  additionalLocales?: string[] | undefined;
  publish: boolean;
  versionId?: string;
  wait: boolean;
  timeout: string;
  translationsDir?: string;
};

export async function sendUpdates(updates: Updates, options: ApiOptions) {
  const { apiKey, projectId, defaultLocale } = options;
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
    ...(options.additionalLocales && {
      additionalLocales: options.additionalLocales,
    }),
    metadata: globalMetadata,
    publish: options.publish,
    ...(options.versionId && { versionId: options.versionId }),
  };

  const spinner = await displayLoadingAnimation(
    'Sending updates to General Translation API...'
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
        ...(options.locales && { locales: options.locales }),
        // only save if locales was previously in options
      });

    // Wait for translations if wait is true
    if (options.wait && locales) {
      console.log();
      // timeout was validated earlier
      const timeout = parseInt(options.timeout) * 1000;
      const result = await waitForUpdates(
        apiKey,
        options.baseUrl,
        versionId,
        locales,
        startTime,
        timeout
      );
    }

    // Save translations to local directory if translationsDir is provided
    if (options.translationsDir) {
      console.log();
      await saveTranslations(
        options.baseUrl,
        apiKey,
        versionId,
        options.translationsDir
      );
    }
  } catch (error) {
    spinner.fail(chalk.red('Failed to send updates'));
    throw error;
  }
}
