import chalk from 'chalk';
import { createSpinner, logMessage, logSuccess } from '../console/logging.js';
import { Settings } from '../types/index.js';
import { FileFormats, FileDataFormat } from '../types/data.js';
import { getAuthHeaders } from '../utils/headers.js';

/**
 * File object structure
 * @param content - The content of the file
 * @param fileName - The name of the file
 * @param fileFormats - The format of the file (JSON, MDX, MD, etc.)
 * @param fileDataFormat - The format of the data within the file
 */
export interface FileToTranslate {
  content: string;
  fileName: string;
  fileFormat: FileFormats;
  fileDataFormat: FileDataFormat;
}

type ApiOptions = Settings & {
  publish: boolean;
  wait: boolean;
};

/**
 * Sends multiple files for translation to the API
 * @param files - Array of file objects to translate
 * @param options - The options for the API call
 * @returns The translated content or version ID
 */
export async function sendFiles(files: FileToTranslate[], options: ApiOptions) {
  logMessage(
    chalk.cyan('Files to translate:') +
      '\n' +
      files.map((file) => `  - ${chalk.bold(file.fileName)}`).join('\n')
  );

  const spinner = createSpinner('dots');
  spinner.start(
    `Sending ${files.length} file${files.length > 1 ? 's' : ''} to General Translation API...`
  );

  try {
    // Create form data
    const formData = new FormData();
    // Add each file to the form data
    files.forEach((file, index) => {
      formData.append(`file${index}`, new Blob([file.content]), file.fileName);
      formData.append(`fileFormat${index}`, file.fileFormat);
      formData.append(`fileDataFormat${index}`, file.fileDataFormat); // Only used when translating JSON files
      formData.append(`fileName${index}`, file.fileName);
    });

    // Add number of files
    formData.append('fileCount', String(files.length));

    // Add other metadata
    formData.append('sourceLocale', options.defaultLocale);
    formData.append('targetLocales', JSON.stringify(options.locales));
    formData.append('projectId', options.projectId);
    formData.append('publish', String(options.publish));
    formData.append('versionId', options._versionId || '');
    formData.append('description', options.description || '');

    const response = await fetch(
      `${options.baseUrl}/v1/project/translations/files/upload`,
      {
        method: 'POST',
        headers: {
          ...getAuthHeaders(options.projectId, options.apiKey),
        },
        body: formData,
      }
    );

    if (!response.ok) {
      spinner.stop(chalk.red(await response.text()));
      process.exit(1);
    }

    const responseData = await response.json();

    // Handle version ID response (for async processing)
    const { data, message, locales, translations } = responseData;
    spinner.stop(chalk.green('Files for translation uploaded successfully'));
    logSuccess(message);

    return { data, locales, translations };
  } catch (error) {
    spinner.stop(chalk.red('Failed to send files for translation'));
    throw error;
  }
}
