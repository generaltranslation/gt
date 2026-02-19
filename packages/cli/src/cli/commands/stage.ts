import { logger } from '../../console/logger.js';
import { logCollectedFiles } from '../../console/logging.js';
import {
  Settings,
  SupportedLibraries,
  TranslateFlags,
} from '../../types/index.js';
import { executeStageFilesWorkflow } from '../../workflows/stage.js';
import { updateVersions } from '../../fs/config/updateVersions.js';
import type { EnqueueFilesResult } from 'generaltranslation/types';
import updateConfig from '../../fs/config/updateConfig.js';
import { FileTranslationData } from '../../workflows/downloadTranslations.js';
import { BranchData } from '../../types/branch.js';
import { TEMPLATE_FILE_ID } from '../../utils/constants.js';
import { collectFiles } from '../../formats/files/collectFiles.js';
import { convertToFileTranslationData } from '../../formats/files/convertToFileTranslationData.js';
import { hasValidCredentials, hasValidLocales } from './utils/validation.js';

export async function handleStage(
  options: TranslateFlags,
  settings: Settings,
  library: SupportedLibraries,
  stage: boolean
): Promise<{
  fileVersionData: FileTranslationData | undefined;
  jobData: EnqueueFilesResult | undefined;
  branchData: BranchData | undefined;
} | null> {
  if (!hasValidLocales(settings)) return null;
  // Validate credentials if not in dry run
  if (!options.dryRun && !hasValidCredentials(settings)) return null;

  const { files: allFiles, reactComponents } = await collectFiles(
    options,
    settings,
    library
  );

  // Dry run
  if (options.dryRun) {
    logger.success(`Dry run: No files were sent to General Translation.`);
    logCollectedFiles(allFiles, reactComponents);
    return null;
  }

  // Send translations to General Translation
  let fileVersionData: FileTranslationData | undefined;
  let jobData: EnqueueFilesResult | undefined;
  let branchData: BranchData | undefined;
  if (allFiles.length > 0) {
    const { branchData: branchDataResult, enqueueResult } =
      await executeStageFilesWorkflow({ files: allFiles, options, settings });
    jobData = enqueueResult;
    branchData = branchDataResult;

    fileVersionData = convertToFileTranslationData(allFiles);

    // This logic is a little scuffed because stage is async from the API
    if (stage) {
      await updateVersions({
        configDirectory: settings.configDirectory,
        versionData: fileVersionData,
      });
    }
    const templateData = allFiles.find(
      (file) => file.fileId === TEMPLATE_FILE_ID
    );
    if (templateData?.versionId) {
      await updateConfig(settings.config, {
        _versionId: templateData.versionId,
        _branchId: branchData.currentBranch.id,
      });
    }
  }

  // Always delete branch id from config if branching is disabled
  // Avoids incorrect CDN queries at runtime
  if (!settings.branchOptions.enabled) {
    await updateConfig(settings.config, {
      _branchId: null,
    });
  }

  return {
    fileVersionData,
    jobData,
    branchData,
  };
}
