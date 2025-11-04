import chalk from 'chalk';
import { logErrorAndExit, logMessage, logSuccess } from '../console/logging.js';
import { Settings, TranslateFlags } from '../types/index.js';
import { gt } from '../utils/gt.js';
import {
  CompletedFileTranslationData,
  FileToTranslate,
  NotYetUploadedFile,
  EnqueueFilesResult,
} from 'generaltranslation/types';
import { TEMPLATE_FILE_NAME } from '../cli/commands/stage.js';
import { Workflow } from '../workflow/Workflow.js';
import {
  UploadStep,
  SetupStep,
  EnqueueStep,
} from '../workflow/WorkflowStep.js';

export type SendFilesResult = {
  data: Record<string, { fileName: string; versionId: string }>;
  locales: string[];
  translations: CompletedFileTranslationData[];
};

/**
 * Helper: Convert FileToTranslate to NotYetUploadedFile entities
 */
function convertToFileEntities(
  files: FileToTranslate[],
  settings: Settings
): NotYetUploadedFile[] {
  if (!settings.defaultLocale) {
    throw new Error('settings.defaultLocale is required');
  }

  return files.map((f) => ({
    fileName: f.fileName,
    fileFormat: f.fileFormat,
    dataFormat: f.dataFormat,
    content: f.content,
    locale: settings.defaultLocale,
    formatMetadata: f.formatMetadata,
  }));
}

/**
 * Helper: Calculate timeout with validation
 */
function calculateTimeout(timeout: string | number | undefined): number {
  const value = timeout !== undefined ? Number(timeout) : 600;
  return (Number.isFinite(value) ? value : 600) * 1000;
}

/**
 * Helper: Log files to be translated
 */
function logFilesToTranslate(files: FileToTranslate[]): void {
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
}

/**
 * Sends multiple files for translation to the API using a workflow pattern
 * @param files - Array of file objects to translate
 * @param options - The options for the API call
 * @param settings - Settings configuration
 * @returns The translated content or version ID
 */
export async function sendFiles(
  files: FileToTranslate[],
  options: TranslateFlags,
  settings: Settings
): Promise<SendFilesResult> {
  try {
    // Log files to be translated
    logFilesToTranslate(files);

    // Convert to file entities
    const fileEntities = convertToFileEntities(files, settings);

    // Calculate timeout for setup step
    const timeoutMs = calculateTimeout(options.timeout);

    // Create workflow with steps
    const workflow = new Workflow<NotYetUploadedFile[], EnqueueFilesResult>([
      new UploadStep(gt, settings),
      new SetupStep(gt, settings, timeoutMs),
      new EnqueueStep(gt, settings, options.force),
    ]);

    // Execute workflow
    const result = await workflow.run(fileEntities);

    logSuccess(result.message);
    return result;
  } catch (error) {
    logErrorAndExit('Failed to send files for translation');
  }
}
