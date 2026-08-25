import { logErrorAndExit } from '../console/logging.js';
import { branchResolutionError, withOriginalError } from '../console/index.js';
import { Settings, TranslateFlags } from '../types/index.js';
import { api } from '../utils/api.js';
import { FileToUpload } from 'generaltranslation/types';
import { UploadSourcesStep } from './steps/UploadSourcesStep.js';
import { SetupStep } from './steps/SetupStep.js';
import { BranchStep } from './steps/BranchStep.js';
import { BranchData } from '../types/branch.js';
import { logCollectedFiles } from '../console/logging.js';
import { calculateTimeoutMs } from '../utils/calculateTimeoutMs.js';
import type { InlineLibrary } from '../types/libraries.js';

/**
 * Sets up a project by uploading files running the setup step
 * @param files - Array of file objects to upload
 * @param options - The options for the API call
 * @param settings - Settings configuration
 * @returns The branch data
 */
export async function runSetupProjectWorkflow(
  files: FileToUpload[],
  options: TranslateFlags,
  settings: Settings,
  inlineLibrary?: InlineLibrary
): Promise<{
  branchData: BranchData;
}> {
  try {
    // Log files to be translated
    logCollectedFiles(files, undefined, inlineLibrary);

    // Calculate timeout for setup step
    const timeoutMs = calculateTimeoutMs(options.timeout);

    // Create workflow with steps
    const branchStep = new BranchStep(api, settings);
    const uploadStep = new UploadSourcesStep(api, settings);
    const setupStep = new SetupStep(api, settings, timeoutMs);

    // first run the branch step
    const branchData = await branchStep.run();

    if (!branchData) {
      return logErrorAndExit(branchResolutionError);
    }

    // then run the upload step
    const uploadedFiles = await uploadStep.run({ files, branchData });

    // then run the setup step
    await setupStep.run(uploadedFiles, options.force ?? false);

    return { branchData };
  } catch (error) {
    return logErrorAndExit(
      withOriginalError(
        'Project setup could not be completed. Check the files, branch configuration, and API credentials, then try again.',
        error
      )
    );
  }
}
