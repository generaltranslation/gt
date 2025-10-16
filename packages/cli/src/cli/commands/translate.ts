import { SendFilesResult } from '../../api/sendFiles.js';
import { TranslateFlags } from '../../types/index.js';
import { Settings } from '../../types/index.js';
import { checkFileTranslations } from '../../api/checkFileTranslations.js';
import { createFileMapping } from '../../formats/files/fileMapping.js';
import { logError } from '../../console/logging.js';
import { getStagedVersions } from '../../fs/config/updateVersions.js';
import copyFile from '../../fs/copyFile.js';
import flattenJsonFiles from '../../utils/flattenJsonFiles.js';
import localizeStaticUrls from '../../utils/localizeStaticUrls.js';
import processAnchorIds from '../../utils/processAnchorIds.js';
import { noFilesError, noVersionIdError } from '../../console/index.js';
import localizeStaticImports from '../../utils/localizeStaticImports.js';

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
      settings,
      options.force,
      options.forceDownload
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
    settings,
    false, // force is not applicable for downloading staged translations
    options.forceDownload
  );
}

export async function postProcessTranslations(
  settings: Settings,
  includeFiles?: Set<string>
) {
  // Localize static urls (/docs -> /[locale]/docs) and preserve anchor IDs for non-default locales
  // Default locale is processed earlier in the flow in base.ts
  if (settings.options?.experimentalLocalizeStaticUrls) {
    const nonDefaultLocales = settings.locales.filter(
      (locale) => locale !== settings.defaultLocale
    );
    if (nonDefaultLocales.length > 0) {
      await localizeStaticUrls(settings, nonDefaultLocales, includeFiles);
    }

    // Add explicit anchor IDs to translated MDX/MD files to preserve navigation
    // Uses inline {#id} format by default, or div wrapping if experimentalAddHeaderAnchorIds is 'mintlify'
    await processAnchorIds(settings, includeFiles);
  }

  // Localize static imports (import Snippet from /snippets/file.mdx -> import Snippet from /snippets/[locale]/file.mdx)
  if (settings.options?.experimentalLocalizeStaticImports) {
    await localizeStaticImports(settings, includeFiles);
  }

  // Flatten json files into a single file
  if (settings.options?.experimentalFlattenJsonFiles) {
    await flattenJsonFiles(settings, includeFiles);
  }

  // Copy files to the target locale
  if (settings.options?.copyFiles) {
    await copyFile(settings);
  }
}
