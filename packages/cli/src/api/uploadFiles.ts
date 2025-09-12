import chalk from 'chalk';
import { createSpinner, exit, logMessage } from '../console/logging.js';
import { Settings } from '../types/index.js';
import { DataFormat, FileFormat } from '../types/data.js';
import { gt } from '../utils/gt.js';

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

  try {
    // Upload sources
    await gt.uploadSourceFiles(files, {
      ...options,
      sourceLocale: options.defaultLocale,
    });

    // Upload translations (if any exist)
    const withTranslations = files.filter((f) => f.translations.length > 0);
    if (withTranslations.length > 0) {
      await gt.uploadTranslations(withTranslations, {
        ...options,
        sourceLocale: options.defaultLocale, // optional, safe to include
      });
    }

    spinner.stop(chalk.green('Files uploaded successfully'));
  } catch {
    spinner.stop(
      chalk.red('An unexpected error occurred while uploading files')
    );
    exit(1);
  }
}
