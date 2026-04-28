import { EnqueueFilesResult } from 'generaltranslation/types';
import { TranslateFlags } from '../../types/index.js';
import { Settings } from '../../types/index.js';
import {
  FileTranslationData,
  runDownloadWorkflow,
} from '../../workflows/download.js';
import { createFileMapping } from '../../formats/files/fileMapping.js';
import copyFile from '../../fs/copyFile.js';
import flattenJsonFiles from '../../utils/flattenJsonFiles.js';
import localizeStaticUrls from '../../utils/localizeStaticUrls.js';
import localizeRelativeAssets from '../../utils/localizeRelativeAssets.js';
import processAnchorIds from '../../utils/processAnchorIds.js';
import processOpenApi from '../../utils/processOpenApi.js';
import localizeStaticImports from '../../utils/localizeStaticImports.js';
import { BranchData } from '../../types/branch.js';
import { getDownloadedMeta } from '../../state/recentDownloads.js';
import { persistPostProcessHashes } from '../../utils/persistPostprocessHashes.js';
import { runPublishWorkflow } from '../../workflows/publish.js';
import { SUPPORTED_FILE_EXTENSIONS } from '../../formats/files/supportedFiles.js';
import { hasNonIdentityFileFormatTransformForType } from '../../formats/files/transformFormat.js';
import { getRelative } from '../../fs/findFilepath.js';

// Downloads translations that were completed
export async function handleTranslate(
  options: TranslateFlags,
  settings: Settings,
  fileVersionData: FileTranslationData | undefined,
  jobData: EnqueueFilesResult | undefined,
  branchData: BranchData | undefined,
  publishMap?: Map<string, boolean>
) {
  if (fileVersionData) {
    const {
      resolvedPaths,
      placeholderPaths,
      transformPaths,
      transformFormats,
    } = settings.files;

    const fileMapping = createFileMapping(
      resolvedPaths,
      placeholderPaths,
      transformPaths,
      transformFormats,
      settings.locales,
      settings.defaultLocale
    );
    // Check for remaining translations
    await runDownloadWorkflow({
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

    // Publish/unpublish files after translations are downloaded
    if (publishMap && branchData?.currentBranch.id) {
      const files = Object.entries(fileVersionData).map(([fileId, data]) => ({
        fileId,
        versionId: data.versionId,
        fileName: data.fileName,
      }));
      await runPublishWorkflow(
        files,
        publishMap,
        branchData.currentBranch.id,
        settings
      );
    }
  }
}

export async function postProcessTranslations(
  settings: Settings,
  includeFiles?: Set<string>
) {
  const postProcessIncludes = filterPostProcessIncludesForFormatTransforms(
    settings,
    includeFiles
  );
  if (includeFiles && postProcessIncludes?.size === 0) return;

  // Mintlify OpenAPI localization (spec routing + validation)
  await processOpenApi(settings, postProcessIncludes);

  // Localize static urls (/docs -> /[locale]/docs) and preserve anchor IDs for non-default locales
  // Default locale is processed earlier in the flow in base.ts
  if (settings.options?.experimentalLocalizeStaticUrls) {
    const nonDefaultLocales = settings.locales.filter(
      (locale) => locale !== settings.defaultLocale
    );
    if (nonDefaultLocales.length > 0) {
      await localizeStaticUrls(
        settings,
        nonDefaultLocales,
        postProcessIncludes
      );
    }
  }

  // Rewrite relative asset URLs in translated md/mdx files
  if (settings.options?.experimentalLocalizeRelativeAssets) {
    const nonDefaultLocales = settings.locales.filter(
      (locale) => locale !== settings.defaultLocale
    );
    if (nonDefaultLocales.length > 0) {
      await localizeRelativeAssets(
        settings,
        nonDefaultLocales,
        postProcessIncludes
      );
    }
  }

  const shouldProcessAnchorIds =
    settings.options?.experimentalLocalizeStaticUrls ||
    settings.options?.experimentalAddHeaderAnchorIds;

  // Add explicit anchor IDs to translated MDX/MD files to preserve navigation
  // Uses inline {#id} format by default, or div wrapping if experimentalAddHeaderAnchorIds is 'mintlify'
  if (shouldProcessAnchorIds) {
    await processAnchorIds(settings, postProcessIncludes);
  }

  // Localize static imports (import Snippet from /snippets/file.mdx -> import Snippet from /snippets/[locale]/file.mdx)
  if (settings.options?.experimentalLocalizeStaticImports) {
    await localizeStaticImports(settings, postProcessIncludes);
  }

  // Flatten json files into a single file
  if (settings.options?.experimentalFlattenJsonFiles) {
    await flattenJsonFiles(settings, postProcessIncludes);
  }

  // Copy files to the target locale
  if (settings.options?.copyFiles) {
    await copyFile(settings);
  }

  // Record postprocessed content hashes for newly downloaded files
  persistPostProcessHashes(settings, postProcessIncludes, getDownloadedMeta());
}

/**
 * Exclude only outputs whose source file was translated into a different format.
 * @param settings - The settings for the project
 * @param includeFiles - The files to include in the post-processing
 * @returns The files to exclude in the post-processing
 */
function filterPostProcessIncludesForFormatTransforms(
  settings: Settings,
  includeFiles?: Set<string>
): Set<string> | undefined {
  if (!includeFiles) return includeFiles;

  const transformedSourcePaths = new Set<string>();
  for (const fileType of SUPPORTED_FILE_EXTENSIONS) {
    if (!hasNonIdentityFileFormatTransformForType(settings, fileType)) continue;

    for (const sourcePath of settings.files.resolvedPaths[fileType] || []) {
      transformedSourcePaths.add(getRelative(sourcePath));
    }
  }
  if (transformedSourcePaths.size === 0) return includeFiles;

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

  const transformedOutputPaths = new Set<string>();
  for (const localeMapping of Object.values(fileMapping)) {
    for (const [sourcePath, outputPath] of Object.entries(localeMapping)) {
      if (transformedSourcePaths.has(sourcePath)) {
        transformedOutputPaths.add(outputPath);
      }
    }
  }

  return new Set(
    [...includeFiles].filter(
      (filePath) => !transformedOutputPaths.has(filePath)
    )
  );
}
