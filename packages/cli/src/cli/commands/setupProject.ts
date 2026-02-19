import { logger } from '../../console/logger.js';
import { logCollectedFiles, logErrorAndExit } from '../../console/logging.js';
import {
  Settings,
  SupportedLibraries,
  TranslateFlags,
} from '../../types/index.js';
import {
  noLocalesError,
  noDefaultLocaleError,
  noApiKeyError,
  noProjectIdError,
  devApiKeyError,
} from '../../console/index.js';
import { FileTranslationData } from '../../workflow/downloadTranslations.js';
import { BranchData } from '../../types/branch.js';
import { collectFiles } from '../../formats/files/collectFiles.js';
import { executeSetupProjectWorkflow } from '../../workflow/setupProject.js';

export async function handleSetupProject(
  options: TranslateFlags,
  settings: Settings,
  library: SupportedLibraries
): Promise<{
  fileVersionData: FileTranslationData | undefined;
  branchData: BranchData | undefined;
} | null> {
  if (!settings.locales) {
    return logErrorAndExit(noLocalesError);
  }
  if (!settings.defaultLocale) {
    return logErrorAndExit(noDefaultLocaleError);
  }
  // Validate required settings are present if not in dry run
  if (!options.dryRun) {
    if (!settings.apiKey) {
      return logErrorAndExit(noApiKeyError);
    }
    if (settings.apiKey.startsWith('gtx-dev-')) {
      return logErrorAndExit(devApiKeyError);
    }
    if (!settings.projectId) {
      return logErrorAndExit(noProjectIdError);
    }
  }

  const { files: allFiles, reactComponents } = await collectFiles(
    options,
    settings,
    library
  );

  // Dry run
  if (options.dryRun) {
    logger.success(`Dry run: No files were uploaded to General Translation.`);
    logCollectedFiles(allFiles, reactComponents);
    return null;
  }

  // Upload files and run setup step
  let fileVersionData: FileTranslationData | undefined;
  let branchData: BranchData | undefined;
  if (allFiles.length > 0) {
    const { branchData: branchDataResult } = await executeSetupProjectWorkflow(
      allFiles,
      options,
      settings
    );
    branchData = branchDataResult;

    fileVersionData = Object.fromEntries(
      allFiles.map((file) => [
        file.fileId,
        {
          fileName: file.fileName,
          versionId: file.versionId,
        },
      ])
    );
  }
  return {
    fileVersionData,
    branchData,
  };
}
