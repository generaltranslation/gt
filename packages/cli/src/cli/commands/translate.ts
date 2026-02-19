import { EnqueueFilesResult } from 'generaltranslation/types';
import { TranslateFlags } from '../../types/index.js';
import { Settings } from '../../types/index.js';
import {
  FileTranslationData,
  executeDownloadTranslationsWorkflow,
} from '../../workflow/downloadTranslations.js';
import { createFileMapping } from '../../formats/files/fileMapping.js';
import { getStagedVersions } from '../../fs/config/updateVersions.js';
import copyFile from '../../fs/copyFile.js';
import flattenJsonFiles from '../../utils/flattenJsonFiles.js';
import localizeStaticUrls from '../../utils/localizeStaticUrls.js';
import localizeRelativeAssets from '../../utils/localizeRelativeAssets.js';
import processAnchorIds from '../../utils/processAnchorIds.js';
import processOpenApi from '../../utils/processOpenApi.js';
import { noFilesError, noVersionIdError } from '../../console/index.js';
import localizeStaticImports from '../../utils/localizeStaticImports.js';
import { BranchData } from '../../types/branch.js';
import { logErrorAndExit } from '../../console/logging.js';
import { getDownloadedMeta } from '../../state/recentDownloads.js';
import { persistPostProcessHashes } from '../../utils/persistPostprocessHashes.js';

// Downloads translations that were completed
export async function handleTranslate(
  options: TranslateFlags,
  settings: Settings,
  fileVersionData: FileTranslationData | undefined,
  jobData: EnqueueFilesResult | undefined,
  branchData: BranchData | undefined
) {
  if (fileVersionData) {
    const { resolvedPaths, placeholderPaths, transformPaths } = settings.files;

    const fileMapping = createFileMapping(
      resolvedPaths,
      placeholderPaths,
      transformPaths,
      settings.locales,
      settings.defaultLocale
    );
    // Check for remaining translations
    await executeDownloadTranslationsWorkflow({
      fileVersionData: fileVersionData,
      jobData: jobData,
      branchData: branchData,
      locales: settings.locales,
      timeoutDuration: options.timeout,
      resolveOutputPath: (sourcePath, locale) =>
        fileMapping[locale]?.[sourcePath] ?? null,
      options: settings,
      forceRetranslation: options.force,
      forceDownload: options.forceDownload || options.force, // if force is true should also force download
    });
  }
}

export async function postProcessTranslations(
  settings: Settings,
  includeFiles?: Set<string>
) {
  // Mintlify OpenAPI localization (spec routing + validation)
  await processOpenApi(settings, includeFiles);

  // Localize static urls (/docs -> /[locale]/docs) and preserve anchor IDs for non-default locales
  // Default locale is processed earlier in the flow in base.ts
  if (settings.options?.experimentalLocalizeStaticUrls) {
    const nonDefaultLocales = settings.locales.filter(
      (locale) => locale !== settings.defaultLocale
    );
    if (nonDefaultLocales.length > 0) {
      await localizeStaticUrls(settings, nonDefaultLocales, includeFiles);
    }
  }

  // Rewrite relative asset URLs in translated md/mdx files
  if (settings.options?.experimentalLocalizeRelativeAssets) {
    const nonDefaultLocales = settings.locales.filter(
      (locale) => locale !== settings.defaultLocale
    );
    if (nonDefaultLocales.length > 0) {
      await localizeRelativeAssets(settings, nonDefaultLocales, includeFiles);
    }
  }

  const shouldProcessAnchorIds =
    settings.options?.experimentalLocalizeStaticUrls ||
    settings.options?.experimentalAddHeaderAnchorIds;

  // Add explicit anchor IDs to translated MDX/MD files to preserve navigation
  // Uses inline {#id} format by default, or div wrapping if experimentalAddHeaderAnchorIds is 'mintlify'
  if (shouldProcessAnchorIds) {
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

  // Record postprocessed content hashes for newly downloaded files
  persistPostProcessHashes(settings, includeFiles, getDownloadedMeta());
}
