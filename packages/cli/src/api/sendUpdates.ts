import chalk from 'chalk';
import { createSpinner, logSuccess } from '../console';
import { Settings, SupportedLibraries, Updates } from '../types';
import updateConfig from '../fs/config/updateConfig';
import { DataFormat } from '../types/data';

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
    ...(dataFormat && { dataFormat }),
    ...(options.version && { versionId: options.version }),
    ...(options.description && { description: options.description }),
    ...(options.requireApproval && {
      requireApproval: options.requireApproval,
    }),
  };

  const spinner = createSpinner('dots');
  spinner.start(`Sending ${library} updates to General Translation API...`);

  try {
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

    if (!response.ok) {
      spinner.stop(chalk.red(await response.text()));
      process.exit(1);
    }

    const { versionId, message, locales } = await response.json();
    spinner.stop(chalk.green('Sent updates'));
    logSuccess(message);

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
