import { SendFilesResult } from '../../api/sendFiles.js';
import { TranslateFlags } from '../../types/index.js';
import { Settings } from '../../types/index.js';
import { checkFileTranslations } from '../../api/checkFileTranslations.js';
import { createFileMapping } from '../../formats/files/fileMapping.js';
import { logError, logErrorAndExit } from '../../console/logging.js';
import { getStagedVersions } from '../../fs/config/updateVersions.js';
import copyFile from '../../fs/copyFile.js';
import localizeStaticImports from '../../utils/localizeStaticImports.js';
import flattenJsonFiles from '../../utils/flattenJsonFiles.js';
import localizeStaticUrls from '../../utils/localizeStaticUrls.js';
import { noFilesError, noVersionIdError } from '../../console/index.js';

// Downloads translations that were completed
export async function handleTranslate(
  options: TranslateFlags,
  settings: Settings,
  filesTranslationResponse: SendFilesResult | undefined
) {
  if (filesTranslationResponse && settings.files) {
    const { resolvedPaths, placeholderPaths, transformPaths } = settings.files;

    const fileMapping = createFileMapping(
      resolvedPaths,
      placeholderPaths,
      transformPaths,
      settings.locales,
      settings.defaultLocale
    );
    const { data } = filesTranslationResponse;
    // Check for remaining translations
    await checkFileTranslations(
      data,
      settings.locales,
      options.timeout,
      (sourcePath, locale) => fileMapping[locale][sourcePath] ?? null,
      settings
    );
  }
}

// Downloads translations that were originally staged
export async function handleDownload(
  options: TranslateFlags,
  settings: Settings
) {
  if (!settings._versionId) {
    logError(noVersionIdError);
    process.exit(1);
  }
  if (!settings.files) {
    logError(noFilesError);
    process.exit(1);
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
  await checkFileTranslations(
    stagedVersionData,
    settings.locales,
    options.timeout,
    (sourcePath, locale) => fileMapping[locale][sourcePath] ?? null,
    settings
  );
}

export async function postProcessTranslations(settings: Settings) {
  // Localize static urls (/docs -> /[locale]/docs) for non-default locales only
  // Default locale is processed earlier in the flow in base.ts
  if (settings.options?.experimentalLocalizeStaticUrls) {
    const nonDefaultLocales = settings.locales.filter(
      locale => locale !== settings.defaultLocale
    );
    if (nonDefaultLocales.length > 0) {
      await localizeStaticUrls(settings, nonDefaultLocales);
    }
  }

  // Localize static imports (/docs -> /[locale]/docs)
  if (settings.options?.experimentalLocalizeStaticImports) {
    await localizeStaticImports(settings);
  }

  // Flatten json files into a single file
  if (settings.options?.experimentalFlattenJsonFiles) {
    await flattenJsonFiles(settings);
  }

  // Copy files to the target locale
  if (settings.options?.copyFiles) {
    await copyFile(settings);
  }
}
