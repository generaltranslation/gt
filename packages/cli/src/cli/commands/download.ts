import { noFilesError, noVersionIdError } from '../../console/index.js';
import { SupportedLibraries, TranslateFlags } from '../../types/index.js';
import { Settings } from '../../types/index.js';
import { createFileMapping } from '../../formats/files/fileMapping.js';
import { getStagedEntriesFromLockfile } from '../../fs/config/downloadedVersions.js';
import {
  runDownloadWorkflow,
  FileTranslationData,
} from '../../workflows/download.js';
import { exitSync, logErrorAndExit } from '../../console/logging.js';
import { convertToFileTranslationData } from '../../formats/files/convertToFileTranslationData.js';
import { collectFiles } from '../../formats/files/collectFiles.js';
import { hasValidCredentials, hasValidLocales } from './utils/validation.js';
import type { InlineLibrary } from '../../types/libraries.js';

// Downloads translations that were originally staged

/**
 * Downloads translations that were originally staged
 * @param options - The options for the command
 * @param settings - The settings for the command
 */
export async function handleDownload(
  options: TranslateFlags,
  settings: Settings,
  library: SupportedLibraries,
  additionalLibraries: readonly InlineLibrary[] = [],
  detectedAdditionalModules?: readonly SupportedLibraries[]
) {
  if (!hasValidLocales(settings)) return exitSync(1);
  // Validate credentials if not in dry run
  if (!options.dryRun && !hasValidCredentials(settings)) return exitSync(1);
  if (!settings.files) {
    return logErrorAndExit(noFilesError);
  }
  // Files
  const { resolvedPaths, placeholderPaths, transformPaths, transformFormats } =
    settings.files;
  const fileMapping = createFileMapping(
    resolvedPaths,
    placeholderPaths,
    transformPaths,
    transformFormats,
    settings.locales,
    settings.defaultLocale
  );

  // Collect the hashes for all files we need to download
  let fileVersionData: FileTranslationData;
  if (settings.stageTranslations) {
    fileVersionData = getStagedEntriesFromLockfile(settings);
  } else {
    const { files } = await collectFiles(
      options,
      settings,
      library,
      additionalLibraries,
      detectedAdditionalModules
    );
    // _versionId is only written by stage when an inline GTJSON template was
    // staged, so demand it only when a GTJSON is part of this download —
    // file-only projects never have one and don't need it. (Staged downloads
    // above resolve all versions from gt-lock.json.) omitConfigIds intentionally
    // never writes _versionId; in that mode the collected GTJSON template carries
    // its own content-derived versionId, so skip the guard rather than fail.
    if (
      !settings.omitConfigIds &&
      !settings._versionId &&
      files.some((file) => file.fileFormat === 'GTJSON')
    ) {
      return logErrorAndExit(noVersionIdError);
    }
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
