import chalk from 'chalk';
import {
  createSpinner,
  logError,
  logMessage,
  logSuccess,
  logWarning,
} from '../console/logging.js';
import { Settings, TranslateFlags } from '../types/index.js';
import { gt } from '../utils/gt.js';
import {
  CompletedFileTranslationData,
  FileToTranslate,
} from 'generaltranslation/types';
import { FileUpload } from './uploadFiles.js';
import { TEMPLATE_FILE_NAME } from '../cli/commands/stage.js';

type SourceUpload = { source: FileUpload };

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
export async function sendFiles(
  files: FileToTranslate[],
  options: TranslateFlags,
  settings: Settings
): Promise<SendFilesResult> {
  logMessage(
    chalk.cyan('Files to translate:') +
      '\n' +
      files
        .map((file) => {
          if (file.fileName === TEMPLATE_FILE_NAME) {
            return `- <React Elements>`;
          }
          return `- ${file.fileName}`;
        })
        .join('\n')
  );

  try {
    // Step 1: Upload files (get references)
    const uploadSpinner = createSpinner('dots');
    uploadSpinner.start(
      `Uploading ${files.length} file${files.length !== 1 ? 's' : ''} to General Translation API...`
    );

    const sourceLocale = settings.defaultLocale;
    if (!sourceLocale) {
      uploadSpinner.stop(chalk.red('Missing default source locale'));
      throw new Error(
        'sendFiles: settings.defaultLocale is required to upload source files'
      );
    }

    // Convert FileToTranslate[] -> { source: FileUpload }[]
    const uploads: SourceUpload[] = files.map(
      ({ content, fileName, fileFormat, dataFormat }) => ({
        source: {
          content,
          fileName,
          fileFormat,
          dataFormat,
          locale: sourceLocale,
        },
      })
    );

    const upload = await gt.uploadSourceFiles(uploads, {
      sourceLocale,
      modelProvider: settings.modelProvider,
    });
    uploadSpinner.stop(chalk.green('Files uploaded successfully'));

    // Check if setup is needed
    const { shouldSetupProject } = await gt.shouldSetupProject();

    // Step 2: Setup if needed and poll until complete
    if (shouldSetupProject) {
      // Calculate timeout once for setup fetching
      const setupTimeoutMs =
        (typeof options?.timeout === 'number' ? options.timeout : 600) * 1000;

      const { setupJobId } = await gt.setupProject(upload.uploadedFiles);

      const setupSpinner = createSpinner('dots');
      setupSpinner.start('Setting up project...');

      const start = Date.now();
      const pollInterval = 2000;

      let setupCompleted = false;
      let setupFailedMessage: string | null = null;

      while (true) {
        const status = await gt.checkSetupStatus(setupJobId);

        if (status.status === 'completed') {
          setupCompleted = true;
          break;
        }
        if (status.status === 'failed') {
          setupFailedMessage = status.error?.message || 'Unknown error';
          break;
        }
        if (Date.now() - start > setupTimeoutMs) {
          setupFailedMessage = 'Timed out while waiting for setup generation';
          break;
        }
        await new Promise((r) => setTimeout(r, pollInterval));
      }

      if (setupCompleted) {
        setupSpinner.stop(chalk.green('Setup successfully completed'));
      } else {
        setupSpinner.stop(
          chalk.yellow(
            `Setup ${setupFailedMessage ? 'failed' : 'timed out'} — proceeding without setup${
              setupFailedMessage ? ` (${setupFailedMessage})` : ''
            }`
          )
        );
      }
    }

    // Step 3: Enqueue translations by reference
    const enqueueSpinner = createSpinner('dots');
    enqueueSpinner.start('Enqueuing translations...');
    const enqueueResult = await gt.enqueueFiles(upload.uploadedFiles, {
      sourceLocale: settings.defaultLocale,
      targetLocales: settings.locales,
      publish: settings.publish,
      requireApproval: settings.stageTranslations,
      modelProvider: settings.modelProvider,
      force: options?.force,
    });

    const { data, message, locales, translations } = enqueueResult;
    enqueueSpinner.stop(
      chalk.green('Files for translation uploaded successfully')
    );
    logSuccess(message);

    return { data, locales, translations };
  } catch (error) {
    logError('Failed to send files for translation');
    throw error;
  }
}
