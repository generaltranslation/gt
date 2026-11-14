import { logCollectedFiles, logErrorAndExit } from '../console/logging.js';
import {
  branchResolutionError,
  workflowFailureMessage,
} from '../console/index.js';
import { Settings, TranslateFlags } from '../types/index.js';
import { requireProject } from '../utils/api.js';
import { FileToUpload } from 'generaltranslation';
import { EnqueueStep, type FileTranslationJob } from './steps/EnqueueStep.js';
import { BranchStep } from './steps/BranchStep.js';
import { logger } from '../console/logger.js';
import { filterFilesForEnqueue } from './utils/filterFilesForEnqueue.js';
import { syncFonts } from './utils/syncFonts.js';
import type { InlineLibrary } from '../types/libraries.js';

/**
 * Enqueues translations for a given set of files
 *  - Only enqueues uploaded files
 *  - Don't have to worry about double enqueuing files because dedupe on API side
 *
 * @param {FileTranslationData} fileVersionData - The file version data
 * @param {TranslateFlags} options - The options for the enqueue operation
 * @param {Settings} settings - The settings for the enqueue operation
 * @returns {Promise<FileTranslationJob[]>} The enqueued file translation jobs
 */
export async function runEnqueueWorkflow({
  files,
  options,
  settings,
  inlineLibrary,
}: {
  files: FileToUpload[];
  options: TranslateFlags;
  settings: Settings;
  inlineLibrary?: InlineLibrary;
}): Promise<FileTranslationJob[]> {
  try {
    // Log files to be enqueued
    logCollectedFiles(files, undefined, inlineLibrary);

    logger.debug('Files: ' + JSON.stringify(files, null, 2));

    // Sync fonts before enqueueing so the translation jobs (e.g. Lottie
    // layout refinement) can use them instead of fallback fonts.
    await syncFonts(settings);

    const project = requireProject(settings);

    // Create workflow with steps
    const branchStep = new BranchStep(project, settings);
    // const queryFileDataStep = new QueryFileDataStep(gt);
    const enqueueStep = new EnqueueStep(project, settings, options.force);

    // (1) run the branch step
    const branchData = await branchStep.run();
    if (!branchData) {
      return logErrorAndExit(branchResolutionError);
    }
    logger.debug('Branch data: ' + JSON.stringify(branchData, null, 2));

    // (2) Enqueue the files
    const filesWithBranch = files.map((files) => ({
      branchId: branchData.currentBranch.id,
      ...files,
    }));
    const { filesToEnqueue, skippedFiles } = await filterFilesForEnqueue({
      gt: project,
      files: filesWithBranch,
      locales: settings.locales,
      force: options.force,
    });
    if (skippedFiles.length > 0) {
      logger.info(
        `Skipped enqueue for ${skippedFiles.length} already translated file${skippedFiles.length === 1 ? '' : 's'}`
      );
    }

    const enqueueResult = await enqueueStep.run(filesToEnqueue);

    logger.debug('Enqueue result: ' + JSON.stringify(enqueueResult, null, 2));

    logEnqueueResult(
      enqueueResult,
      filesToEnqueue.length === 0 ? files.length : filesToEnqueue.length
    );
    return enqueueResult;
  } catch (error) {
    return logErrorAndExit(
      workflowFailureMessage('Translations could not be enqueued.', error)
    );
  }
}

// ----- Helper functions ----- //

/**
 * Logs the enqueue result
 * @param jobs - The enqueued file translation jobs
 * @returns void
 */
function logEnqueueResult(jobs: FileTranslationJob[], fileCount: number): void {
  if (jobs.length === 0) {
    logger.success(
      `All ${fileCount} ${fileCount === 1 ? 'file' : 'files'} already translated. 0 files enqueued.`
    );
  } else {
    logger.success(
      `Successfully enqueued ${jobs.length} file translation jobs`
    );
  }
}
