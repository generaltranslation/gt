import chalk from 'chalk';
import {
  branchResolutionError,
  noProjectIdError,
  workflowFailureMessage,
} from '../console/index.js';
import { logger } from '../console/logger.js';
import { logErrorAndExit } from '../console/logging.js';
import { Settings } from '../types/index.js';
import { createClients } from '../utils/api.js';
import { syncFonts } from './utils/syncFonts.js';
import { BranchStep } from './steps/BranchStep.js';
import { UploadSourcesStep } from './steps/UploadSourcesStep.js';
import { UploadTranslationsStep } from './steps/UploadTranslationsStep.js';
import type { FileReference, FileToUpload } from 'generaltranslation/types';
import { getWarnings } from '../state/translateWarnings.js';
import { BranchData } from '../types/branch.js';

/**
 * Uploads multiple files to the API using a workflow pattern
 * @param files - Array of file objects to upload
 * @param options - The options for the API call
 * @returns The branch data resolved during the workflow and the source files
 * the platform holds (uploaded now or already present)
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
}): Promise<{ branchData: BranchData; uploadedFiles: FileReference[] }> {
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

    const { project } = createClients(options);
    if (!project) throw new Error(noProjectIdError);

    // Create workflow steps
    const branchStep = new BranchStep(project, options);
    const uploadStep = new UploadSourcesStep(project, options);
    const uploadTranslationsStep = new UploadTranslationsStep(project, options);

    // Step 1: Resolve branch information
    const branchData = await branchStep.run();

    if (!branchData) {
      return logErrorAndExit(branchResolutionError);
    }

    const uploadedFiles = await uploadStep.run({
      files: files.map((f) => f.source),
      branchData,
    });

    // Step 3: Upload translations (if any exist). The API rejects the whole
    // batch when one source is missing, so skip sources that were not saved.
    const uploadedSources = new Set(
      uploadedFiles.map((f) => `${f.fileId}:${f.versionId}`)
    );
    const filesWithTranslations = files
      .filter(
        (f) =>
          f.translations.length > 0 &&
          uploadedSources.has(`${f.source.fileId}:${f.source.versionId}`)
      )
      .map((f) => ({
        ...f,
        source: {
          ...f.source,
          branchId: f.source.branchId ?? branchData.currentBranch.id,
        },
      }));
    if (filesWithTranslations.length > 0) {
      await uploadTranslationsStep.run({
        files: filesWithTranslations,
      });
    }

    if (getWarnings().some((w) => w.category === 'failed_upload')) {
      logger.warn('Some files could not be uploaded. See the warnings above.');
    } else {
      logger.success('All files uploaded successfully');
    }
    return { branchData, uploadedFiles };
  } catch (error) {
    return logErrorAndExit(
      workflowFailureMessage('Files could not be uploaded.', error)
    );
  }
}
