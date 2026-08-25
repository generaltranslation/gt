import chalk from 'chalk';
import { branchResolutionError, withOriginalError } from '../console/index.js';
import { logger } from '../console/logger.js';
import { logErrorAndExit } from '../console/logging.js';
import { Settings } from '../types/index.js';
import { api } from '../utils/api.js';
import { syncFonts } from './utils/syncFonts.js';
import { BranchStep } from './steps/BranchStep.js';
import { UploadSourcesStep } from './steps/UploadSourcesStep.js';
import { UploadTranslationsStep } from './steps/UploadTranslationsStep.js';
import type { FileToUpload } from 'generaltranslation/types';
import { BranchData } from '../types/branch.js';

/**
 * Uploads multiple files to the API using a workflow pattern
 * @param files - Array of file objects to upload
 * @param options - The options for the API call
 * @returns The branch data resolved during the workflow
 */
export async function runUploadFilesWorkflow({
  files,
  options,
}: {
  files: {
    source: FileToUpload;
    translations: FileToUpload[];
  }[];
  options: Settings;
}): Promise<{ branchData: BranchData }> {
  try {
    logger.message(
      chalk.cyan('Files to upload:') +
        '\n' +
        files
          .map(
            (file) =>
              `  - ${chalk.bold(file.source.fileName)}${file.translations.length > 0 ? ` -> ${file.translations.map((t) => t.locale).join(', ')}` : ''}`
          )
          .join('\n')
    );

    // Sync fonts first (locale-invariant) so they're available when
    // translating formats that need them.
    await syncFonts(options);

    // Create workflow steps
    const branchStep = new BranchStep(api, options);
    const uploadStep = new UploadSourcesStep(api, options);
    const uploadTranslationsStep = new UploadTranslationsStep(api, options);

    // Step 1: Resolve branch information
    const branchData = await branchStep.run();

    if (!branchData) {
      return logErrorAndExit(branchResolutionError);
    }

    await uploadStep.run({ files: files.map((f) => f.source), branchData });

    // Step 3: Upload translations (if any exist)
    const filesWithTranslations = files.filter(
      (f) => f.translations.length > 0
    );
    if (filesWithTranslations.length > 0) {
      await uploadTranslationsStep.run({
        files: filesWithTranslations,
      });
    }

    logger.success('All files uploaded successfully');
    return { branchData };
  } catch (error) {
    return logErrorAndExit(
      withOriginalError(
        'Files could not be uploaded. Check the files, branch configuration, and API credentials, then try again.',
        error
      )
    );
  }
}
