import * as fs from 'fs';
import * as path from 'path';
import { logger } from '../console/logger.js';
import { gt } from '../utils/gt.js';
import { Settings } from '../types/index.js';
import { validateJsonSchema } from '../formats/json/utils.js';
import { validateYamlSchema } from '../formats/yaml/utils.js';
import { mergeJson } from '../formats/json/mergeJson.js';
import { extractJson } from '../formats/json/extractJson.js';
import mergeYaml from '../formats/yaml/mergeYaml.js';
import { extractYaml } from '../formats/yaml/extractYaml.js';
import {
  resolveMintlifyRefs,
  shouldResolveRefs,
} from '../utils/resolveMintlifyRefs.js';
import {
  readLockfile,
  writeLockfile,
  findOrCreateEntry,
} from '../fs/config/downloadedVersions.js';
import { recordDownloaded, recordRemerged } from '../state/recentDownloads.js';
import { recordWarning } from '../state/translateWarnings.js';
import stringify from 'fast-json-stable-stringify';
import { SUPPORTED_FILE_EXTENSIONS } from '../formats/files/supportedFiles.js';
import { hasNonIdentityFileFormatTransformForType } from '../formats/files/transformFormat.js';
import { getRelative } from '../fs/findFilepath.js';

/**
 * The platform withholds unapproved review-gated GTJSON components from
 * served output. Reports the delta between the source component count and
 * the served content so partially-served files don't read as fully
 * translated — for both fresh downloads and already-downloaded skips.
 */
function reportWithheldGtJsonComponents(
  fileFormat: string | undefined,
  servedContent: string,
  componentCount: number | undefined,
  locale: string
): void {
  if (fileFormat !== 'GTJSON' || componentCount == null) return;
  const received = countGtJsonEntries(servedContent);
  if (received == null) return;
  const withheld = componentCount - received;
  if (withheld > 0) {
    recordWarning(
      'pending_review',
      '<React Elements>',
      `${withheld} component translation(s) for locale ${locale} require review and are not approved yet`
    );
  }
}

function reportWithheldGtJsonComponentsFromFile(
  outputPath: string,
  componentCount: number | undefined,
  locale: string
): void {
  if (componentCount == null) return;
  try {
    reportWithheldGtJsonComponents(
      'GTJSON',
      fs.readFileSync(outputPath, 'utf8'),
      componentCount,
      locale
    );
  } catch {
    // Warning metadata is advisory; an unreadable cached output should not
    // turn an otherwise valid skipped download into a batch failure.
  }
}

/**
 * Counts entries in downloaded GTJSON output, tolerating both the flat
 * public shape and a wrapped { type, data } shape.
 */
function countGtJsonEntries(content: string): number | undefined {
  try {
    const parsed = JSON.parse(content);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return undefined;
    }
    const entries =
      parsed.type === 'GTJSON' &&
      parsed.data &&
      typeof parsed.data === 'object' &&
      !Array.isArray(parsed.data)
        ? parsed.data
        : parsed;
    return Object.keys(entries).length;
  } catch {
    return undefined;
  }
}

function sortJsonString(data: string): string {
  const sortedData = stringify(JSON.parse(data));
  return JSON.stringify(JSON.parse(sortedData), null, 2);
}

/**
 * Merges translated content with the current source file for schema-based formats.
 */
function mergeWithSource(
  translatedContent: string,
  locale: string,
  inputPath: string,
  options: Settings
): string {
  if (shouldSkipSourceFormatMerge(inputPath, options)) {
    return translatedContent;
  }
  if (!options.options) return translatedContent;

  const jsonSchema = options.options.jsonSchema
    ? validateJsonSchema(options.options, inputPath)
    : null;
  const yamlSchema =
    !jsonSchema && options.options.yamlSchema
      ? validateYamlSchema(options.options, inputPath)
      : null;

  if (!jsonSchema && !yamlSchema) return translatedContent;

  const sourceContent = fs.readFileSync(inputPath, 'utf8');
  if (!sourceContent) return translatedContent;

  if (jsonSchema) {
    // Resolve $ref before merging if configured
    let resolvedSourceContent = sourceContent;
    if (shouldResolveRefs(inputPath, options.options)) {
      try {
        const json = JSON.parse(sourceContent);
        const { resolved } = resolveMintlifyRefs(json, inputPath);
        resolvedSourceContent = JSON.stringify(resolved, null, 2);
      } catch {
        // Fall through with original content
      }
    }
    return mergeJson(
      resolvedSourceContent,
      inputPath,
      options.options,
      [{ translatedContent, targetLocale: locale }],
      options.defaultLocale,
      options.locales
    )[0];
  } else {
    return mergeYaml(
      sourceContent,
      inputPath,
      options.options,
      [{ translatedContent, targetLocale: locale }],
      options.defaultLocale
    )[0];
  }
}

/**
 * Determines whether a source file should be skipped for schema re-merging.
 * @param inputPath - The path of the source file
 * @param options - The settings for the project
 * @returns True if the source file should be skipped for schema re-merging, false otherwise
 */
function shouldSkipSourceFormatMerge(
  inputPath: string,
  options: Settings
): boolean {
  for (const fileType of SUPPORTED_FILE_EXTENSIONS) {
    if (!hasNonIdentityFileFormatTransformForType(options, fileType)) continue;

    const transformedSourcePaths = options.files.resolvedPaths[fileType] || [];
    if (
      transformedSourcePaths.some(
        (sourcePath) => getRelative(sourcePath) === inputPath
      )
    ) {
      return true;
    }
  }

  return false;
}

export type BatchedFiles = {
  branchId: string;
  fileId: string;
  versionId: string;
  locale: string;
  outputPath: string;
  inputPath: string;
  componentCount?: number;
}[];

export type DownloadFileBatchResult = {
  successful: BatchedFiles;
  failed: BatchedFiles;
  skipped: BatchedFiles;
};

async function remergeExistingTranslation(
  outputPath: string,
  inputPath: string,
  locale: string,
  options: Settings
): Promise<void> {
  if (!options.options?.jsonSchema && !options.options?.yamlSchema) {
    return;
  }

  // For schema-based files, re-merge with current source in case
  // non-translatable fields changed (skip the API download, not the merge).
  try {
    let existingContent = fs.readFileSync(outputPath, 'utf8');
    // Resolve $ref before extraction if configured
    if (shouldResolveRefs(outputPath, options.options)) {
      try {
        const json = JSON.parse(existingContent);
        const { resolved } = resolveMintlifyRefs(json, outputPath);
        existingContent = JSON.stringify(resolved, null, 2);
      } catch {
        // Fall through with original content
      }
    }
    const jsonExtracted = options.options?.jsonSchema
      ? extractJson(
          existingContent,
          inputPath,
          options.options,
          locale,
          options.defaultLocale
        )
      : null;
    const extracted =
      jsonExtracted ??
      (options.options?.yamlSchema
        ? extractYaml(existingContent, inputPath, options.options)
        : null);
    if (!extracted) return;

    const remerged = mergeWithSource(extracted, locale, inputPath, options);
    let remergedData = remerged;
    if (outputPath.endsWith('.json')) {
      try {
        remergedData = sortJsonString(remergedData);
      } catch {
        // Fall through with unsorted content
      }
    }
    if (remergedData !== existingContent) {
      await fs.promises.writeFile(outputPath, remergedData);
    }
    // Track for postprocessing (e.g. openapi path localization)
    // even when the API download was skipped.
    recordRemerged(outputPath);
  } catch (error) {
    // If re-merge fails, still count as skipped — not worth failing
    // the download, but surface it so missing output is diagnosable.
    logger.warn(
      `Failed to re-merge existing translation for ${outputPath} (${locale}): ${error}`
    );
  }
}

/**
 * Downloads multiple translation files in a single batch request
 * @param files - Array of files to download with their output paths
 * @param maxRetries - Maximum number of retry attempts
 * @param retryDelay - Delay between retries in milliseconds
 * @returns Object containing successful and failed file IDs
 */
export async function downloadFileBatch(
  files: BatchedFiles,
  options: Settings,
  forceDownload: boolean = false
): Promise<DownloadFileBatchResult> {
  // Local record of what version was last downloaded for each fileName:locale
  const {
    data: downloadedVersions,
    entryMap,
    originalV1,
  } = readLockfile(options);
  let didUpdateDownloadedLock = false;

  const result: DownloadFileBatchResult = {
    successful: [],
    failed: [],
    skipped: [],
  };

  const filesToDownload: BatchedFiles = [];
  for (const file of files) {
    const existingEntry = entryMap.get(file.fileId);
    const isComposite = !!(
      options.options?.jsonSchema &&
      validateJsonSchema(options.options, file.inputPath)?.composite
    );
    if (
      !forceDownload &&
      fs.existsSync(file.outputPath) &&
      existingEntry?.versionId === file.versionId &&
      existingEntry.translations[file.locale] &&
      !isComposite
    ) {
      await remergeExistingTranslation(
        file.outputPath,
        file.inputPath,
        file.locale,
        options
      );
      reportWithheldGtJsonComponentsFromFile(
        file.outputPath,
        file.componentCount,
        file.locale
      );
      result.skipped.push(file);
      continue;
    }

    filesToDownload.push(file);
  }

  if (filesToDownload.length === 0) {
    return result;
  }

  const requestedFiles = new Map(
    filesToDownload.map((file) => [
      `${file.branchId}:${file.fileId}:${file.versionId}:${file.locale}`,
      file,
    ])
  );

  try {
    // Download the files
    const responseData = await gt.downloadFileBatch(
      filesToDownload.map((file) => ({
        fileId: file.fileId,
        branchId: file.branchId,
        versionId: file.versionId,
        locale: file.locale,
      }))
    );
    const downloadedFiles = responseData.files || [];

    // Process each file in the response
    for (const file of downloadedFiles) {
      if (!file.locale) {
        continue;
      }
      const fileKey = `${file.branchId}:${file.fileId}:${file.versionId}:${file.locale}`;
      const requestedFile = requestedFiles.get(fileKey);
      if (!requestedFile) {
        continue;
      }
      requestedFiles.delete(fileKey);
      try {
        // Ensure the directory exists
        const dir = path.dirname(requestedFile.outputPath);
        if (!fs.existsSync(dir)) {
          fs.mkdirSync(dir, { recursive: true });
        }
        let data = mergeWithSource(
          file.data,
          requestedFile.locale,
          requestedFile.inputPath,
          options
        );

        // Stable sort JSON keys for deterministic output
        if (
          file.fileFormat === 'GTJSON' ||
          requestedFile.outputPath.endsWith('.json')
        ) {
          try {
            data = sortJsonString(data);
          } catch (error) {
            logger.warn(`Failed to sort JSON file: ${file.id}: ` + error);
          }
        }

        // Write the file to disk
        await fs.promises.writeFile(requestedFile.outputPath, data);
        // Track as downloaded with metadata for downstream postprocessing
        recordDownloaded(requestedFile.outputPath, {
          branchId: requestedFile.branchId,
          fileId: requestedFile.fileId,
          versionId: requestedFile.versionId,
          locale: requestedFile.locale,
          inputPath: requestedFile.inputPath,
        });

        reportWithheldGtJsonComponents(
          file.fileFormat,
          data,
          requestedFile.componentCount,
          requestedFile.locale
        );

        result.successful.push(requestedFile);
        const entry = findOrCreateEntry(
          entryMap,
          downloadedVersions.entries,
          requestedFile.fileId,
          requestedFile.versionId
        );
        entry.fileName = requestedFile.inputPath;
        entry.staged = false;
        entry.translations[requestedFile.locale] = {
          updatedAt: new Date().toISOString(),
          fileName: getRelative(requestedFile.outputPath),
        };
        didUpdateDownloadedLock = true;
      } catch (error) {
        logger.error(`Error saving file ${fileKey}: ` + error);
        recordWarning(
          'failed_download',
          fileKey,
          `Error saving file: ${error}`
        );
        result.failed.push(requestedFile);
      }
    }

    result.failed.push(...requestedFiles.values());

    // Persist any updates to the downloaded map at the end of a successful cycle
    if (didUpdateDownloadedLock) {
      writeLockfile(downloadedVersions, originalV1);
    }
    return result;
  } catch (error) {
    logger.error(
      `An unexpected error occurred while downloading files: ` + error
    );
  }

  // Mark all files as failed if we get here
  result.failed.push(...requestedFiles.values());
  if (didUpdateDownloadedLock) {
    writeLockfile(downloadedVersions, originalV1);
  }
  return result;
}
