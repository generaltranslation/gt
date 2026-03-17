import { logCollectedFiles, logErrorAndExit } from '../console/logging.js';
import { Settings, TranslateFlags } from '../types/index.js';
import { gt } from '../utils/gt.js';
import { EnqueueFilesResult, FileToUpload } from 'generaltranslation/types';
import { UploadSourcesStep } from './steps/UploadSourcesStep.js';
import { SetupStep } from './steps/SetupStep.js';
import { EnqueueStep } from './steps/EnqueueStep.js';
import { BranchStep } from './steps/BranchStep.js';
import { BranchData } from '../types/branch.js';
import { calculateTimeoutMs } from '../utils/calculateTimeoutMs.js';
import { collectAndSendUserEditDiffs } from '../api/collectUserEditDiffs.js';
import { logger } from '../console/logger.js';
import chalk from 'chalk';

/**
 * Sends multiple files for translation to the API using a workflow pattern
 * @param files - Array of file objects to translate
 * @param options - The options for the API call
 * @param settings - Settings configuration
 * @returns The translated content or version ID
 */
export async function runStageFilesWorkflow({
  files,
  options,
  settings,
}: {
  files: FileToUpload[];
  options: TranslateFlags;
  settings: Settings;
}): Promise<{
  branchData: BranchData;
  enqueueResult: EnqueueFilesResult;
}> {
  try {
    // Log files to be translated
    logCollectedFiles(files);

    // Calculate timeout for setup step
    const timeoutMs = calculateTimeoutMs(options.timeout);

    // Create workflow with steps
    const branchStep = new BranchStep(gt, settings);
    const uploadStep = new UploadSourcesStep(gt, settings);
    const setupStep = new SetupStep(gt, settings, timeoutMs);
    const enqueueStep = new EnqueueStep(gt, settings, options.force);

    // first run the branch step
    const branchData = await branchStep.run();
    await branchStep.wait();
    if (!branchData) {
      return logErrorAndExit('Failed to resolve git branch information.');
    }

    // then run the upload step
    const uploadedFiles = await uploadStep.run({ files, branchData });
    await uploadStep.wait();

    // optionally collect and send user edit diffs
    if (options?.saveLocal) {
      const spinner = logger.createSpinner('dots');
      spinner.start('Updating translations...');
      try {
        await collectAndSendUserEditDiffs(
          uploadedFiles,
          settings,
          branchData.currentBranch.id
        );
        spinner.stop(chalk.green('Updated translations'));
      } catch {
        // Non-fatal; keep going to enqueue
        spinner.stop(chalk.green('Updated translations'));
      }
    }

    // then run the setup step
    await setupStep.run(uploadedFiles);
    await setupStep.wait();

    // then run the enqueue step
    const enqueueResult = await enqueueStep.run(uploadedFiles);
    await enqueueStep.wait();

    return { branchData, enqueueResult };
  } catch (error) {
    return logErrorAndExit('Failed to send files for translation. ' + error);
  }
}
