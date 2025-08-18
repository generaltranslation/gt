import chalk from 'chalk';
import { createSpinner, logMessage, logSuccess } from '../console/logging.js';
import { Settings } from '../types/index.js';
import { gt } from '../utils/gt.js';
import {
  CompletedFileTranslationData,
  FileToTranslate,
} from 'generaltranslation/types';

export type ApiOptions = Settings & {
  publish: boolean;
  wait: boolean;
};

export type SendFilesResult = {
  data: Record<string, { fileName: string; versionId: string }>;
  locales: string[];
  translations: CompletedFileTranslationData[];
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
    `Sending ${files.length} file${files.length !== 1 ? 's' : ''} to General Translation API...`
  );

  try {
    // Send the files to the API
    const responseData = await gt.enqueueFiles(files, {
      publish: options.publish,
      description: options.description,
      sourceLocale: options.defaultLocale,
      targetLocales: options.locales,
      _versionId: options._versionId,
      modelProvider: options.modelProvider,
    });

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
