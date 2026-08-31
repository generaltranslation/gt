import { noDefaultLocaleError } from '../../console/index.js';
import { exitSync, logErrorAndExit } from '../../console/logging.js';
import { logger } from '../../console/logger.js';
import {
  getRelative,
  readFile,
  readBinaryFileBase64,
} from '../../fs/findFilepath.js';
import { isBinaryFileFormat } from 'generaltranslation/types';
import { Settings } from '../../types/index.js';
import { UploadOptions } from '../base.js';
import { extractJson } from '../../formats/json/extractJson.js';
import { extractXcstrings } from '../../formats/xcstrings/extractXcstrings.js';
import { validateJsonSchema } from '../../formats/json/utils.js';
import { runUploadFilesWorkflow } from '../../workflows/upload.js';
import { existsSync, readFileSync } from 'node:fs';
import { createFileMapping } from '../../formats/files/fileMapping.js';
import type { FileToUpload } from 'generaltranslation/types';
import { hasValidCredentials } from './utils/validation.js';
import { runPublishWorkflow } from '../../workflows/publish.js';
import { aggregateFiles } from '../../formats/files/aggregateFiles.js';

/**
 * Sends multiple files to the API for translation
 * @param settings - Translation options including API settings
 * @returns Promise that resolves when translation is complete
 */
export async function upload(
  settings: Settings & UploadOptions
): Promise<void> {
  if (!settings.files) {
    return;
  }

  const additionalOptions = settings.options || {};
  const {
    resolvedPaths: filePaths,
    placeholderPaths,
    transformPaths,
    transformFormats,
  } = settings.files;

  // Reuse the same source aggregation path as translate/stage so source
  // parsing behavior stays consistent across commands.
  const { files: allFiles, publishMap } = await aggregateFiles(settings);

  // Files whose translations live in the same on-disk file as the source:
  // composite JSON (per jsonSchema) and xcstrings catalogs (per format).
  // Their per-locale content is extracted from the raw file at upload time.
  const inPlaceTranslationFiles = new Map<
    string,
    { filePath: string; content: string; fileType: 'json' | 'xcstrings' }
  >();
  const sourceFileNames = new Set(allFiles.map((file) => file.fileName));

  if (filePaths.json) {
    for (const filePath of filePaths.json) {
      const relativePath = getRelative(filePath);
      if (!sourceFileNames.has(relativePath)) continue;

      const jsonSchema = validateJsonSchema(additionalOptions, filePath);
      if (jsonSchema?.composite) {
        inPlaceTranslationFiles.set(relativePath, {
          filePath,
          content: readFile(filePath),
          fileType: 'json',
        });
      }
    }
  }

  if (filePaths.xcstrings) {
    for (const filePath of filePaths.xcstrings) {
      const relativePath = getRelative(filePath);
      if (!sourceFileNames.has(relativePath)) continue;

      inPlaceTranslationFiles.set(relativePath, {
        filePath,
        content: readFile(filePath),
        fileType: 'xcstrings',
      });
    }
  }

  if (allFiles.length === 0) {
    logger.error(
      'No files to upload were found. Check your configuration and try again.'
    );
    return;
  }

  if (!settings.defaultLocale) {
    return logErrorAndExit(noDefaultLocaleError);
  }
  if (!hasValidCredentials(settings)) return exitSync(1);

  const locales = settings.locales || [];
  // Create file mapping for all file types
  const fileMapping = createFileMapping(
    filePaths,
    placeholderPaths,
    transformPaths,
    transformFormats,
    locales,
    settings.defaultLocale
  );

  // construct object
  const uploadData = allFiles.map((file) => {
    const sourceFile: FileToUpload = { ...file };

    const translations: FileToUpload[] = [];
    const inPlaceInfo = inPlaceTranslationFiles.get(file.fileName);

    for (const locale of locales) {
      if (inPlaceInfo) {
        // In-place translations: extract each locale from the source file
        const extracted =
          inPlaceInfo.fileType === 'xcstrings'
            ? extractXcstrings(inPlaceInfo.content, file.fileName, locale)
            : extractJson(
                inPlaceInfo.content,
                inPlaceInfo.filePath,
                additionalOptions,
                locale,
                settings.defaultLocale
              );
        if (extracted) {
          translations.push({
            content: extracted,
            fileName: file.fileName,
            fileFormat: file.transformFormat ?? file.fileFormat,
            dataFormat: file.dataFormat,
            locale,
            fileId: file.fileId,
            versionId: file.versionId,
          });
        }
      } else {
        // Non-composite: look for separate translation files
        const translatedFileName = fileMapping[locale]?.[file.fileName];
        if (translatedFileName && existsSync(translatedFileName)) {
          const translationFormat = file.transformFormat ?? file.fileFormat;
          // Binary formats (e.g. LOTTIE zip bundles) travel base64-encoded;
          // decoding their bytes as UTF-8 would corrupt the archive.
          const translatedContent = isBinaryFileFormat(translationFormat)
            ? readBinaryFileBase64(translatedFileName)
            : readFileSync(translatedFileName, 'utf8');
          translations.push({
            content: translatedContent,
            fileName: translatedFileName,
            fileFormat: translationFormat,
            dataFormat: file.dataFormat,
            locale,
            fileId: file.fileId,
            versionId: file.versionId,
          });
        }
      }
    }
    return {
      source: sourceFile,
      translations,
    };
  });

  try {
    // Send all files in a single API call
    const { branchData } = await runUploadFilesWorkflow({
      files: uploadData,
      options: settings,
    });

    // Publish files to CDN if publish config exists
    await runPublishWorkflow(
      allFiles,
      publishMap,
      branchData.currentBranch.id,
      settings
    );
  } catch (error) {
    logErrorAndExit(`Error uploading files: ${error}`);
  }
}
