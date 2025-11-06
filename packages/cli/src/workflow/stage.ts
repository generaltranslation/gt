import chalk from 'chalk';
import { logErrorAndExit, logMessage, logSuccess } from '../console/logging.js';
import { Settings, TranslateFlags } from '../types/index.js';
import { gt } from '../utils/gt.js';
import { EnqueueFilesResult, FileToUpload } from 'generaltranslation/types';
import { TEMPLATE_FILE_NAME } from '../cli/commands/stage.js';
import { UploadStep } from './UploadStep.js';
import { SetupStep } from './SetupStep.js';
import { EnqueueStep } from './EnqueueStep.js';
import { BranchStep } from './BranchStep.js';
import { BranchData } from '../types/branch.js';

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
function logFilesToTranslate(files: FileToUpload[]): void {
  logMessage(
    chalk.cyan('Files found in project:') +
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
export async function stageFiles(
  files: FileToUpload[],
  options: TranslateFlags,
  settings: Settings
): Promise<{
  branchData: BranchData;
  enqueueResult: EnqueueFilesResult;
}> {
  try {
    // Log files to be translated
    logFilesToTranslate(files);

    // Calculate timeout for setup step
    const timeoutMs = calculateTimeout(options.timeout);

    // Create workflow with steps
    const branchStep = new BranchStep(gt, settings);
    const uploadStep = new UploadStep(gt, settings);
    const setupStep = new SetupStep(gt, settings, timeoutMs);
    const enqueueStep = new EnqueueStep(gt, settings, options.force);

    // first run the branch step
    const branchData = await branchStep.run();
    await branchStep.wait();

    if (!branchData) {
      logErrorAndExit(
        'Failed to resolve git branch information. Please run the CLI in a git repository.'
      );
    }

    // then run the upload step
    const uploadedFiles = await uploadStep.run({ files, branchData });
    await uploadStep.wait();

    // then run the setup step
    await setupStep.run(uploadedFiles);
    await setupStep.wait();

    // then run the enqueue step
    const enqueueResult = await enqueueStep.run(uploadedFiles);
    await enqueueStep.wait();

    return { branchData, enqueueResult };
  } catch (error) {
    logErrorAndExit('Failed to send files for translation');
  }
}
