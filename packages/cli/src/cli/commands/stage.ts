import { logger } from '../../console/logger.js';
import { exitSync, logCollectedFiles } from '../../console/logging.js';
import {
  Settings,
  SupportedLibraries,
  TranslateFlags,
} from '../../types/index.js';
import { runStageFilesWorkflow } from '../../workflows/stage.js';
import { writeStagedEntries } from '../../fs/config/downloadedVersions.js';
import type { EnqueueFilesResult } from 'generaltranslation/types';
import updateConfig from '../../fs/config/updateConfig.js';
import { FileTranslationData } from '../../workflows/download.js';
import { BranchData } from '../../types/branch.js';
import { TEMPLATE_FILE_ID } from '../../utils/constants.js';
import { collectFiles } from '../../formats/files/collectFiles.js';
import { convertToFileTranslationData } from '../../formats/files/convertToFileTranslationData.js';
import { hasValidCredentials, hasValidLocales } from './utils/validation.js';
import { warnManualReviewSetup } from '../../translation/reviewSetupWarning.js';

export async function handleStage(
  options: TranslateFlags,
  settings: Settings,
  library: SupportedLibraries,
  stage: boolean
): Promise<{
  fileVersionData: FileTranslationData | undefined;
  jobData: EnqueueFilesResult | undefined;
  completedTranslationKeys: ReadonlySet<string> | undefined;
  branchData: BranchData | undefined;
  publishMap: Map<string, boolean>;
} | null> {
  if (!hasValidLocales(settings)) return exitSync(1);
  // Validate credentials if not in dry run
  if (!options.dryRun && !hasValidCredentials(settings)) return exitSync(1);

  const {
    files: allFiles,
    reactComponents,
    publishMap,
  } = await collectFiles(options, settings, library);

  // Point at dashboard review setup when uploading review-gated content
  await warnManualReviewSetup(settings, allFiles);

  // Dry run
  if (options.dryRun) {
    logger.success(`Dry run: No files were sent to General Translation.`);
    logCollectedFiles(allFiles, reactComponents);
    return null;
  }

  if (allFiles.length === 0 && !settings.publish) {
    logger.error(
      'No files to translate were found. Check your configuration and try again.'
    );
  }

  // Send translations to General Translation
  let fileVersionData: FileTranslationData | undefined;
  let jobData: EnqueueFilesResult | undefined;
  let completedTranslationKeys: ReadonlySet<string> | undefined;
  let branchData: BranchData | undefined;
  if (allFiles.length > 0) {
    const {
      branchData: branchDataResult,
      enqueueResult,
      completedTranslationKeys: completedKeys,
    } = await runStageFilesWorkflow({ files: allFiles, options, settings });
    jobData = enqueueResult;
    completedTranslationKeys = completedKeys;
    branchData = branchDataResult;

    fileVersionData = convertToFileTranslationData(allFiles);

    // Write staged entries to the lockfile
    if (stage) {
      const stagedFiles = Object.entries(fileVersionData).map(
        ([fileId, data]) => ({
          fileId,
          versionId: data.versionId,
          fileName: data.fileName,
        })
      );
      writeStagedEntries(settings, stagedFiles, branchData.currentBranch.id);
    }
    const templateData = allFiles.find(
      (file) => file.fileId === TEMPLATE_FILE_ID
    );
    if (settings.omitConfigIds) {
      // Remove persisted config IDs only after staging has succeeded, so
      // failed and empty runs keep the previous pinned version/branch state
      await updateConfig(settings.config, {
        _versionId: null,
        _branchId: null,
      });
    } else if (templateData?.versionId) {
      await updateConfig(settings.config, {
        _versionId: templateData.versionId,
        _branchId: branchData.currentBranch.id,
      });
    }
  }

  // Always delete branch id from config if branching is disabled
  // Avoids incorrect CDN queries at runtime
  if (!settings.branchOptions.enabled && !settings.omitConfigIds) {
    await updateConfig(settings.config, {
      _branchId: null,
    });
  }

  return {
    fileVersionData,
    jobData,
    completedTranslationKeys,
    branchData,
    publishMap,
  };
}
