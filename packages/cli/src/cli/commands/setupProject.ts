import { logger } from '../../console/logger.js';
import { logCollectedFiles } from '../../console/logging.js';
import {
  Settings,
  SupportedLibraries,
  TranslateFlags,
} from '../../types/index.js';
import { FileTranslationData } from '../../workflow/downloadTranslations.js';
import { BranchData } from '../../types/branch.js';
import { collectFiles } from '../../formats/files/collectFiles.js';
import { executeSetupProjectWorkflow } from '../../workflow/setupProject.js';
import { hasValidCredentials, hasValidLocales } from './utils/validation.js';

export async function handleSetupProject(
  options: TranslateFlags,
  settings: Settings,
  library: SupportedLibraries
): Promise<{
  fileVersionData: FileTranslationData | undefined;
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
