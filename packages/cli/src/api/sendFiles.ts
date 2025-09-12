import chalk from 'chalk';
import {
  createSpinner,
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
          content: Buffer.from(content).toString('base64'),
          fileName,
          fileFormat,
          dataFormat,
          locale: sourceLocale,
        },
      })
    );

    logWarning(uploads[0].source.locale);
    const upload = await gt.uploadSourceFiles(uploads, {
      sourceLocale,
      modelProvider: settings.modelProvider,
    });
    uploadSpinner.stop(chalk.green('Files uploaded successfully'));

    const contextCheckTimeoutMs =
      (typeof options?.timeout === 'number' ? options.timeout : 600) * 1000;

    // Check if context is needed
    const { shouldGenerateContext } = await gt.shouldGenerateContext(contextCheckTimeoutMs);

    // Step 2: Generate context if needed and poll until complete
    if (shouldGenerateContext) {
      const { contextJobId } = await gt.generateContext(upload.uploadedFiles);

      const contextSpinner = createSpinner('dots');
      contextSpinner.start('Generating project context...');

      const start = Date.now();
      // Use CLI --timeout (seconds) for overall context wait; default is set by flag parser
      const timeoutMs =
        (typeof options?.timeout === 'number'
          ? options.timeout
          : 600) /* seconds */ * 1000;
      const pollInterval = 2000;

      let contextCompleted = false;
      let contextFailedMessage: string | null = null;

      while (true) {
        const status = await gt.checkContextStatus(contextJobId);

        if (status.status === 'completed') {
          contextCompleted = true;
          break;
        }
        if (status.status === 'failed') {
          contextFailedMessage = status.error?.message || 'Unknown error';
          break;
        }
        if (Date.now() - start > timeoutMs) {
          contextFailedMessage =
            'Timed out while waiting for context generation';
          break;
        }
        await new Promise((r) => setTimeout(r, pollInterval));
      }

      if (contextCompleted) {
        contextSpinner.stop(chalk.green('Context successfully generated'));
      } else {
        contextSpinner.stop(
          chalk.yellow(
            `Context generation ${contextFailedMessage ? 'failed' : 'timed out'} — proceeding without context${
              contextFailedMessage ? ` (${contextFailedMessage})` : ''
            }`
          )
        );
      }
    }

    // Step 3: Enqueue translations by reference
    const enqueueSpinner = createSpinner('dots');
    enqueueSpinner.start('Enqueuing translations...');
    const enqueueResult = await gt.enqueueFilesByRef(upload.uploadedFiles, {
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
    // Attempt to stop any running spinner gracefully
    // Note: individual phase spinners stop themselves on success paths
    // Fall back message on unexpected error
    const failSpinner = createSpinner('dots');
    failSpinner.stop(chalk.red('Failed to send files for translation'));
    throw error;
  }
}
