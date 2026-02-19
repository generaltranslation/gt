import { logCollectedFiles, logErrorAndExit } from '../console/logging.js';
import { Settings, TranslateFlags } from '../types/index.js';
import { gt } from '../utils/gt.js';
import { EnqueueFilesResult, FileToUpload } from 'generaltranslation/types';
import { EnqueueStep } from './steps/EnqueueStep.js';
import { BranchStep } from './steps/BranchStep.js';
import { logger } from '../console/logger.js';

/**
 * Enqueues translations for a given set of files
 *  - Only enqueues uploaded files
 *  - Don't have to worry about double enqueuing files because dedupe on API side
 *
 * @param {FileTranslationData} fileVersionData - The file version data
 * @param {TranslateFlags} options - The options for the enqueue operation
 * @param {Settings} settings - The settings for the enqueue operation
 * @returns {Promise<EnqueueFilesResult>} The enqueue result
 */
export async function runEnqueueWorkflow({
  files,
  options,
  settings,
}: {
  files: FileToUpload[];
  options: TranslateFlags;
  settings: Settings;
}): Promise<EnqueueFilesResult> {
  try {
    // Log files to be enqueued
    logCollectedFiles(files);

    logger.debug('Files: ' + JSON.stringify(files, null, 2));

    // Create workflow with steps
    const branchStep = new BranchStep(gt, settings);
    // const queryFileDataStep = new QueryFileDataStep(gt);
    const enqueueStep = new EnqueueStep(gt, settings, options.force);

    // (1) run the branch step
    const branchData = await branchStep.run();
    await branchStep.wait();
    if (!branchData) {
      return logErrorAndExit('Failed to resolve git branch information.');
    }
    logger.debug('Branch data: ' + JSON.stringify(branchData, null, 2));

    // (2) Enqueue the files
    const enqueueResult = await enqueueStep.run(
      files.map((files) => ({
        branchId: branchData.currentBranch.id,
        ...files,
      }))
    );
    await enqueueStep.wait();

    logger.debug('Enqueue result: ' + JSON.stringify(enqueueResult, null, 2));

    logEnqueueResult(enqueueResult, files);
    return enqueueResult;
  } catch (error) {
    return logErrorAndExit('Failed to enqueue translations. ' + error);
  }
}

// ----- Helper functions ----- //

/**
 * Logs the enqueue result
 * @param enqueueResult - The enqueue result
 * @returns void
 */
function logEnqueueResult(
  enqueueResult: EnqueueFilesResult,
  files: FileToUpload[]
): void {
  if (Object.keys(enqueueResult.jobData).length === 0) {
    logger.success(
      `All ${files.length} files already translated. 0 files enqueued.`
    );
  } else {
    logger.success(enqueueResult.message);
  }
}
