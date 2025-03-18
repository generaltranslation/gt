import chalk from 'chalk';
import { displayLoadingAnimation } from '../console/console';
import { Settings, Updates } from '../types';
import updateConfig from '../fs/config/updateConfig';
import { waitForUpdates } from './waitForUpdates';
import { FileFormats } from '../types/data';

// Define a file object structure
export interface FileToTranslate {
  content: string;
  fileName: string;
  fileFormat: FileFormats;
}

type ApiOptions = Settings & {
  publish: boolean;
  wait: boolean;
  timeout: string;
};

/**
 * Sends multiple files for translation to the API
 * @param files - Array of file objects to translate
 * @param options - The options for the API call
 * @returns The translated content or version ID
 */
export async function sendFiles(files: FileToTranslate[], options: ApiOptions) {
  const { apiKey, projectId, defaultLocale } = options;

  const spinner = await displayLoadingAnimation(
    `Sending ${files.length} file${files.length > 1 ? 's' : ''} to Translation API...`
  );

  try {
    const startTime = Date.now();
    // Create form data
    const formData = new FormData();

    // Add each file to the form data
    files.forEach((file, index) => {
      formData.append(`file${index}`, new Blob([file.content]), file.fileName);
      formData.append(`fileFormat${index}`, file.fileFormat);
    });

    // Add number of files
    formData.append('fileCount', String(files.length));

    // Add other metadata
    formData.append('sourceLocale', options.defaultLocale);
    formData.append('targetLocales', JSON.stringify(options.locales));
    formData.append('projectId', options.projectId);
    formData.append('publish', String(options.publish));
    formData.append('versionId', options.versionId || '');

    const response = await fetch(
      `${options.baseUrl}/v1/project/translations/files`,
      {
        method: 'POST',
        headers: {
          ...(apiKey && { 'x-gt-api-key': apiKey }),
        },
        body: formData,
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

    const responseData = await response.json();

    // Handle file translation response
    if (responseData.translatedFiles) {
      spinner.succeed(chalk.green('Files translated successfully'));
      return responseData.translatedFiles;
    }

    // Handle version ID response (for async processing)
    const { versionId, message, locales } = responseData;
    spinner.succeed(
      chalk.green(message || 'Translation job submitted successfully')
    );

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
      const result = await waitForUpdates(
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
    spinner.fail(chalk.red('Failed to send files for translation'));
    throw error;
  }
}
