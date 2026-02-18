import * as fs from 'fs';
import * as path from 'path';
import { logger } from '../console/logger.js';
import { gt } from '../utils/gt.js';
import { Settings } from '../types/index.js';
import { validateJsonSchema } from '../formats/json/utils.js';
import { validateYamlSchema } from '../formats/yaml/utils.js';
import { mergeJson } from '../formats/json/mergeJson.js';
import mergeYaml from '../formats/yaml/mergeYaml.js';
import {
  getDownloadedVersions,
  saveDownloadedVersions,
  ensureNestedObject,
} from '../fs/config/downloadedVersions.js';
import { recordDownloaded } from '../state/recentDownloads.js';
import { recordWarning } from '../state/translateWarnings.js';
import { hashStringSync } from '../utils/hash.js';
import stringify from 'fast-json-stable-stringify';
import type { FileStatusTracker } from '../workflow/PollJobsStep.js';

export type BatchedFiles = {
  branchId: string;
  fileId: string;
  versionId: string;
  locale: string;
  outputPath: string;
  inputPath: string;
}[];

export type DownloadFileBatchResult = {
  successful: BatchedFiles;
  failed: BatchedFiles;
  skipped: BatchedFiles;
};
/**
 * Downloads multiple translation files in a single batch request
 * @param files - Array of files to download with their output paths
 * @param maxRetries - Maximum number of retry attempts
 * @param retryDelay - Delay between retries in milliseconds
 * @returns Object containing successful and failed file IDs
 */
export async function downloadFileBatch(
  fileTracker: FileStatusTracker,
  files: BatchedFiles,
  options: Settings,
  forceDownload: boolean = false
): Promise<DownloadFileBatchResult> {
  // Local record of what version was last downloaded for each fileName:locale
  const downloadedVersions = getDownloadedVersions(options.configDirectory);
  let didUpdateDownloadedLock = false;

  // Create a map of requested file keys to the file object
  const requestedFileMap = new Map(
    files.map((file) => [
      `${file.branchId}:${file.fileId}:${file.versionId}:${file.locale}`,
      file,
    ])
  );
  const result: DownloadFileBatchResult = {
    successful: [],
    failed: [],
    skipped: [],
  };

  // Create a map of translationId to outputPath for easier lookup
  const outputPathMap = new Map(
    files.map((file) => [
      `${file.branchId}:${file.fileId}:${file.versionId}:${file.locale}`,
      file.outputPath,
    ])
  );

  try {
    // Download the files
    const responseData = await gt.downloadFileBatch(
      files.map((file) => ({
        fileId: file.fileId,
        branchId: file.branchId,
        versionId: file.versionId,
        locale: file.locale,
      }))
    );
    const downloadedFiles = responseData.files || [];

    // Process each file in the response
    for (const file of downloadedFiles) {
      const fileKey = `${file.branchId}:${file.fileId}:${file.versionId}:${file.locale}`;
      const requestedFile = requestedFileMap.get(fileKey);
      if (!requestedFile) {
        continue;
      }
      try {
        const outputPath = outputPathMap.get(fileKey);
        const fileProperties = fileTracker.completed.get(fileKey);

        if (!outputPath || !fileProperties) {
          logger.warn(`No input/output path found for file: ${fileKey}`);
          recordWarning(
            'failed_download',
            fileKey,
            'No input/output path found'
          );
          result.failed.push(requestedFile);
          continue;
        }

        const {
          fileId,
          versionId,
          locale,
          branchId,
          fileName: inputPath,
        } = fileProperties;

        // Ensure the directory exists
        const dir = path.dirname(outputPath);
        if (!fs.existsSync(dir)) {
          fs.mkdirSync(dir, { recursive: true });
        }
        // If a local translation already exists for the same source version, skip overwrite
        const downloadedVersion =
          downloadedVersions.entries[branchId]?.[fileId]?.[versionId]?.[locale];
        const fileExists = fs.existsSync(outputPath);

        let sourceChanged = false;
        if (downloadedVersion?.sourceHash) {
          try {
            const currentSourceContent = fs.readFileSync(inputPath, 'utf8');
            const currentSourceHash = hashStringSync(currentSourceContent);
            sourceChanged = currentSourceHash !== downloadedVersion.sourceHash;
          } catch {
            sourceChanged = true;
          }
        }

        if (
          !forceDownload &&
          !sourceChanged &&
          fileExists &&
          downloadedVersion
        ) {
          result.skipped.push(requestedFile);
          continue;
        }
        let data = file.data;
        let sourceContentHash: string | undefined;
        if (options.options?.jsonSchema && locale) {
          const jsonSchema = validateJsonSchema(options.options, inputPath);
          if (jsonSchema) {
            const originalContent = fs.readFileSync(inputPath, 'utf8');
            if (originalContent) {
              sourceContentHash = hashStringSync(originalContent);
              data = mergeJson(
                originalContent,
                inputPath,
                options.options,
                [
                  {
                    translatedContent: file.data,
                    targetLocale: locale,
                  },
                ],
                options.defaultLocale,
                options.locales
              )[0];
            }
          }
        }

        if (options.options?.yamlSchema && locale) {
          const yamlSchema = validateYamlSchema(options.options, inputPath);
          if (yamlSchema) {
            const originalContent = fs.readFileSync(inputPath, 'utf8');
            if (originalContent) {
              sourceContentHash = hashStringSync(originalContent);
              data = mergeYaml(
                originalContent,
                inputPath,
                options.options,
                [
                  {
                    translatedContent: file.data,
                    targetLocale: locale,
                  },
                ],
                options.defaultLocale
              )[0];
            }
          }
        }

        // If the file is a GTJSON file, stable sort the order and format the data
        if (file.fileFormat === 'GTJSON') {
          try {
            const jsonData = JSON.parse(data);
            const sortedData = stringify(jsonData); // stably sort with fast-json-stable-stringify
            const sortedJsonData = JSON.parse(sortedData);
            data = JSON.stringify(sortedJsonData, null, 2); // format the data
          } catch (error) {
            logger.warn(`Failed to sort GTJson file: ${file.id}: ` + error);
          }
        }

        // Write the file to disk
        await fs.promises.writeFile(outputPath, data);
        // Track as downloaded with metadata for downstream postprocessing
        recordDownloaded(outputPath, {
          branchId,
          fileId,
          versionId,
          locale,
          inputPath,
        });

        result.successful.push(requestedFile);
        if (branchId && fileId && versionId && locale) {
          ensureNestedObject(downloadedVersions.entries, [
            branchId,
            fileId,
            versionId,
            locale,
          ]);
          downloadedVersions.entries[branchId][fileId][versionId][locale] = {
            updatedAt: new Date().toISOString(),
            ...(sourceContentHash ? { sourceHash: sourceContentHash } : {}),
          };
          didUpdateDownloadedLock = true;
        }
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

    // Add any files that weren't in the response to the failed list
    const downloadedFileKeys = new Set(
      downloadedFiles.map(
        (file) =>
          `${file.branchId}:${file.fileId}:${file.versionId}:${file.locale}`
      )
    );
    for (const [fileKey, requestedFile] of requestedFileMap.entries()) {
      if (!downloadedFileKeys.has(fileKey)) {
        result.failed.push(requestedFile);
      }
    }

    // Persist any updates to the downloaded map at the end of a successful cycle
    if (didUpdateDownloadedLock) {
      saveDownloadedVersions(options.configDirectory, downloadedVersions);
      didUpdateDownloadedLock = false;
    }
    return result;
  } catch (error) {
    logger.error(
      `An unexpected error occurred while downloading files: ` + error
    );
  }

  // Mark all files as failed if we get here
  result.failed = [...requestedFileMap.values()];
  if (didUpdateDownloadedLock) {
    saveDownloadedVersions(options.configDirectory, downloadedVersions);
  }
  return result;
}
