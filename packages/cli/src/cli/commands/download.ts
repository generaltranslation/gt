import { noVersionIdError, noFilesError } from '../../console/index.js';
import { SupportedLibraries, TranslateFlags } from '../../types/index.js';
import { Settings } from '../../types/index.js';
import { createFileMapping } from '../../formats/files/fileMapping.js';
import { getStagedVersions } from '../../fs/config/updateVersions.js';
import {
  runDownloadWorkflow,
  FileTranslationData,
} from '../../workflows/download.js';
import { exitSync, logErrorAndExit } from '../../console/logging.js';
import { convertToFileTranslationData } from '../../formats/files/convertToFileTranslationData.js';
import { collectFiles } from '../../formats/files/collectFiles.js';
import { hasValidCredentials, hasValidLocales } from './utils/validation.js';

// Downloads translations that were originally staged

/**
 * Downloads translations that were originally staged
 * @param options - The options for the command
 * @param settings - The settings for the command
 */
export async function handleDownload(
  options: TranslateFlags,
  settings: Settings,
  library: SupportedLibraries
) {
  if (!hasValidLocales(settings)) return exitSync(1);
  // Validate credentials if not in dry run
  if (!options.dryRun && !hasValidCredentials(settings)) return exitSync(1);
  if (!settings._versionId) {
    return logErrorAndExit(noVersionIdError);
  }
  if (!settings.files) {
    return logErrorAndExit(noFilesError);
  }
  // Files
  const { resolvedPaths, placeholderPaths, transformPaths } = settings.files;
  const fileMapping = createFileMapping(
    resolvedPaths,
    placeholderPaths,
    transformPaths,
    settings.locales,
    settings.defaultLocale
  );

  // Collect the hashes for all files we need to download
  let fileVersionData: FileTranslationData;
  if (settings.stageTranslations) {
    fileVersionData = await getStagedVersions(settings.configDirectory);
  } else {
    const { files } = await collectFiles(options, settings, library);
    fileVersionData = convertToFileTranslationData(files);
  }

  // Check for remaining translations
  await runDownloadWorkflow({
    fileVersionData: fileVersionData,
    jobData: undefined,
    branchData: undefined,
    locales: settings.locales,
    timeoutDuration: options.timeout,
    resolveOutputPath: (sourcePath, locale) =>
      fileMapping[locale][sourcePath] ?? null,
    options: settings,
    forceRetranslation: false, // force is not applicable for downloading staged translations
    forceDownload: options.force || options.forceDownload,
  });
}
