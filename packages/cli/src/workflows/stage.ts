import { logCollectedFiles, logErrorAndExit } from '../console/logging.js';
import { branchResolutionError, withOriginalError } from '../console/index.js';
import { logger } from '../console/logger.js';
import { Settings, TranslateFlags } from '../types/index.js';
import { gt } from '../utils/gt.js';
import type {
  EnqueueFilesResult,
  FileReference,
  FileToUpload,
} from 'generaltranslation/types';
import { UploadSourcesStep } from './steps/UploadSourcesStep.js';
import { SetupStep } from './steps/SetupStep.js';
import { EnqueueStep } from './steps/EnqueueStep.js';
import { BranchStep } from './steps/BranchStep.js';
import { TagStep } from './steps/TagStep.js';
import { UserEditDiffsStep } from './steps/UserEditDiffsStep.js';
import { BranchData } from '../types/branch.js';
import { calculateTimeoutMs } from '../utils/calculateTimeoutMs.js';
import { filterFilesForEnqueue } from './utils/filterFilesForEnqueue.js';
import { syncFonts } from './utils/syncFonts.js';
import type { InlineLibrary } from '../types/libraries.js';

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
  inlineLibrary,
}: {
  files: FileToUpload[];
  options: TranslateFlags;
  settings: Settings;
  inlineLibrary?: InlineLibrary;
}): Promise<{
  branchData: BranchData;
  enqueueResult: EnqueueFilesResult;
  uploadedFiles: FileReference[];
}> {
  try {
    // Log files to be translated
    logCollectedFiles(files, undefined, inlineLibrary);

    // Sync fonts before enqueueing so the translation jobs (e.g. Lottie
    // layout refinement) can use them instead of fallback fonts.
    await syncFonts(settings);

    // Calculate timeout for setup step
    const timeoutMs = calculateTimeoutMs(options.timeout);

    // Create workflow with steps
    const branchStep = new BranchStep(gt, settings);
    const uploadStep = new UploadSourcesStep(gt, settings);
    const userEditDiffsStep = new UserEditDiffsStep(settings);
    const setupStep = new SetupStep(gt, settings, timeoutMs);
    const enqueueStep = new EnqueueStep(gt, settings, options.force);

    // first run the branch step
    const branchData = await branchStep.run();
    if (!branchData) {
      return logErrorAndExit(branchResolutionError);
    }

    // then run the upload step
    const uploadedFiles = await uploadStep.run({
      files,
      branchData,
      deferIdentityActivation: options?.saveLocal === true,
    });

    // optionally run the user edit diffs step
    if (options?.saveLocal) {
      await userEditDiffsStep.run(uploadedFiles);
      uploadStep.activateConfirmedFileIdentities(
        uploadedFiles,
        branchData.currentBranch.id
      );
    }

    // then run the tag step (non-fatal — tagging failure should not block translations)
    if (settings.tag) {
      try {
        const userProvidedTag = !!options.tag;
        const tagStep = new TagStep(gt, settings, userProvidedTag);
        await tagStep.run(uploadedFiles);
      } catch {
        logger.warn('Failed to create translation tag. Continuing...');
      }
    }

    // then run the setup step
    await setupStep.run(uploadedFiles);

    // then run the enqueue step
    const { filesToEnqueue, skippedFiles } = await filterFilesForEnqueue({
      gt,
      files: uploadedFiles,
      locales: settings.locales,
      force: options.force,
    });
    if (skippedFiles.length > 0) {
      logger.info(
        `Skipped enqueue for ${skippedFiles.length} already translated file${skippedFiles.length === 1 ? '' : 's'}`
      );
    }

    const enqueueResult = await enqueueStep.run(filesToEnqueue);

    return { branchData, enqueueResult, uploadedFiles };
  } catch (error) {
    return logErrorAndExit(
      withOriginalError(
        'Files could not be sent for translation. Check the files, branch configuration, and API credentials, then try again.',
        error
      )
    );
  }
}
