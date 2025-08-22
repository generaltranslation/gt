import chalk from 'chalk';
import { createSpinner, exit, logMessage } from '../console/logging.js';
import { Settings } from '../types/index.js';
import { DataFormat, FileFormat } from '../types/data.js';

export type FileUpload = {
  content: string;
  fileName: string;
  fileFormat: FileFormat;
  dataFormat?: DataFormat;
  locale: string;
};

export type UploadData = {
  data: { source: FileUpload; translations: FileUpload[] }[];
  sourceLocale: string;
  modelProvider?: string;
};

/**
 * Uploads multiple files to the API
 * @param files - Array of file objects to upload
 * @param options - The options for the API call
 * @returns The uploaded content or version ID
 */
export async function uploadFiles(
  files: {
    source: FileUpload;
    translations: FileUpload[];
  }[],
  options: Settings
) {
  logMessage(
    chalk.cyan('Files to upload:') +
      '\n' +
      files
        .map(
          (file) =>
            `  - ${chalk.bold(file.source.fileName)} -> ${file.translations
              .map((t) => t.locale)
              .join(', ')}`
        )
        .join('\n')
  );

  const spinner = createSpinner('dots');
  spinner.start(
    `Uploading ${files.length} file${files.length !== 1 ? 's' : ''} to General Translation...`
  );

  const uploadData: UploadData = {
    data: files.map((file) => ({
      source: file.source,
      translations: file.translations,
    })),
    sourceLocale: options.defaultLocale,
    ...(options.modelProvider && { modelProvider: options.modelProvider }),
  };

  try {
    const response = await fetch(`${options.baseUrl}/v1/project/files/upload`, {
      method: 'POST',
      body: JSON.stringify(uploadData),
      headers: {
        'Content-Type': 'application/json',
        'x-gt-api-key': options.apiKey!,
        'x-gt-project-id': options.projectId!,
      },
    });
    if (!response.ok) {
      throw new Error(
        `Failed to upload files: ${response.statusText} (${response.status})`
      );
    }
    spinner.stop(chalk.green('Files uploaded successfully'));

    return response;
  } catch (error) {
    spinner.stop(
      chalk.red('An unexpected error occurred while uploading files')
    );
    exit(1);
  }
}
