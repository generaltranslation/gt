import { noVersionIdError, noFilesError } from '../../console/index.js';
import { TranslateFlags } from '../../types/index.js';
import { Settings } from '../../types/index.js';
import { createFileMapping } from '../../formats/files/fileMapping.js';
import { getStagedVersions } from '../../fs/config/updateVersions.js';
import { executeDownloadTranslationsWorkflow } from '../../workflow/downloadTranslations.js';
import { logErrorAndExit } from '../../console/logging.js';

// Downloads translations that were originally staged

/**
 * Downloads translations that were originally staged
 * @param options - The options for the command
 * @param settings - The settings for the command
 */
export async function handleDownload(
  options: TranslateFlags,
  settings: Settings
) {
  if (!settings._versionId) {
    logErrorAndExit(noVersionIdError);
  }
  if (!settings.files) {
    logErrorAndExit(noFilesError);
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
  const stagedVersionData = await getStagedVersions(settings.configDirectory);
  // Check for remaining translations
  await executeDownloadTranslationsWorkflow({
    fileVersionData: stagedVersionData,
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
