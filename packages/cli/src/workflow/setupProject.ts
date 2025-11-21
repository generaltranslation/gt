import { logErrorAndExit } from '../console/logging.js';
import { Settings, TranslateFlags } from '../types/index.js';
import { gt } from '../utils/gt.js';
import { FileToUpload } from 'generaltranslation/types';
import { UploadStep } from './UploadStep.js';
import { SetupStep } from './SetupStep.js';
import { BranchStep } from './BranchStep.js';
import { BranchData } from '../types/branch.js';
import { logCollectedFiles } from '../console/logging.js';

/**
 * Helper: Calculate timeout with validation
 */
function calculateTimeout(timeout: string | number | undefined): number {
  const value = timeout !== undefined ? Number(timeout) : 600;
  return (Number.isFinite(value) ? value : 600) * 1000;
}

/**
 * Sets up a project by uploading files running the setup step
 * @param files - Array of file objects to upload
 * @param options - The options for the API call
 * @param settings - Settings configuration
 * @returns The branch data
 */
export async function setupProject(
  files: FileToUpload[],
  options: TranslateFlags,
  settings: Settings
): Promise<{
  branchData: BranchData;
}> {
  try {
    // Log files to be translated
    logCollectedFiles(files);

    // Calculate timeout for setup step
    const timeoutMs = calculateTimeout(options.timeout);

    // Create workflow with steps
    const branchStep = new BranchStep(gt, settings);
    const uploadStep = new UploadStep(gt, settings);
    const setupStep = new SetupStep(gt, settings, timeoutMs);

    // first run the branch step
    const branchData = await branchStep.run();
    await branchStep.wait();

    if (!branchData) {
      return logErrorAndExit('Failed to resolve git branch information.');
    }

    // then run the upload step
    const uploadedFiles = await uploadStep.run({ files, branchData });
    await uploadStep.wait();

    // then run the setup step
    await setupStep.run(uploadedFiles, options.force ?? false);
    await setupStep.wait();

    return { branchData };
  } catch (error) {
    return logErrorAndExit('Failed to run project setup. ' + error);
  }
}
