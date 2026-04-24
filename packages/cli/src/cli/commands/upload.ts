import {
  noSupportedFormatError,
  noDefaultLocaleError,
} from '../../console/index.js';
import { exitSync, logErrorAndExit } from '../../console/logging.js';
import { logger } from '../../console/logger.js';
import { getRelative, readFile } from '../../fs/findFilepath.js';
import path from 'node:path';
import { ResolvedFiles, Settings, TransformFiles } from '../../types/index.js';
import { FileFormat, DataFormat } from '../../types/data.js';
import { SUPPORTED_FILE_EXTENSIONS } from '../../formats/files/supportedFiles.js';
import { UploadOptions } from '../base.js';
import sanitizeFileContent from '../../utils/sanitizeFileContent.js';
import { parseJson } from '../../formats/json/parseJson.js';
import { extractJson } from '../../formats/json/extractJson.js';
import { validateJsonSchema } from '../../formats/json/utils.js';
import {
  resolveMintlifyRefs,
  shouldResolveRefs,
} from '../../utils/resolveMintlifyRefs.js';
import { runUploadFilesWorkflow } from '../../workflows/upload.js';
import { existsSync, readFileSync } from 'node:fs';
import { createFileMapping } from '../../formats/files/fileMapping.js';
import parseYaml from '../../formats/yaml/parseYaml.js';
import type { FileToUpload } from 'generaltranslation/types';
import { hashStringSync } from '../../utils/hash.js';
import { hasValidCredentials } from './utils/validation.js';
import { buildPublishMap } from '../../utils/resolvePublish.js';
import { runPublishWorkflow } from '../../workflows/publish.js';

const SUPPORTED_DATA_FORMATS = ['JSX', 'ICU', 'I18NEXT'];

/**
 * Sends multiple files to the API for translation
 * @param filePaths - Resolved file paths for different file types
 * @param placeholderPaths - Placeholder paths for translated files
 * @param transformPaths - Transform paths for file naming
 * @param dataFormat - Format of the data within the files
 * @param settings - Translation options including API settings
 * @returns Promise that resolves when translation is complete
 */
export async function upload(
  filePaths: ResolvedFiles,
  placeholderPaths: ResolvedFiles,
  transformPaths: TransformFiles,
  dataFormat: DataFormat = 'JSX',
  settings: Settings & UploadOptions
): Promise<void> {
  // Collect all files to translate
  const allFiles: FileToUpload[] = [];
  const additionalOptions = settings.options || {};
  const compositeJsonFiles = new Map<
    string,
    { filePath: string; content: string }
  >();

  // Process JSON files
  if (filePaths.json) {
    if (!SUPPORTED_DATA_FORMATS.includes(dataFormat)) {
      logErrorAndExit(noSupportedFormatError);
    }

    const jsonFiles = filePaths.json.map((filePath) => {
      const content = readFile(filePath);

      // Resolve $ref before parsing if configured
      let contentForParsing = content;
      if (shouldResolveRefs(filePath, additionalOptions)) {
        try {
          const json = JSON.parse(content);
          const { resolved } = resolveMintlifyRefs(json, filePath);
          contentForParsing = JSON.stringify(resolved, null, 2);
        } catch {
          // JSON parse errors are handled below by parseJson
        }
      }

      const parsedJson = parseJson(
        contentForParsing,
        filePath,
        additionalOptions,
        settings.defaultLocale
      );

      const relativePath = getRelative(filePath);

      const jsonSchema = validateJsonSchema(additionalOptions, filePath);
      if (jsonSchema?.composite) {
        compositeJsonFiles.set(relativePath, { filePath, content });
      }

      return {
        content: parsedJson,
        fileName: relativePath,
        fileFormat: 'JSON' as FileFormat,
        dataFormat,
        locale: settings.defaultLocale,
        fileId: hashStringSync(relativePath),
        versionId: hashStringSync(parsedJson),
      } satisfies FileToUpload;
    });
    allFiles.push(...jsonFiles);
  }

  // Process YAML files
  if (filePaths.yaml) {
    if (!SUPPORTED_DATA_FORMATS.includes(dataFormat)) {
      logErrorAndExit(noSupportedFormatError);
    }

    const yamlFiles = filePaths.yaml.map((filePath) => {
      const content = readFile(filePath);
      const { content: parsedYaml, fileFormat } = parseYaml(
        content,
        filePath,
        additionalOptions
      );

      const relativePath = getRelative(filePath);
      return {
        content: parsedYaml,
        fileName: relativePath,
        fileFormat,
        dataFormat,
        locale: settings.defaultLocale,
        fileId: hashStringSync(relativePath),
        versionId: hashStringSync(parsedYaml),
      } satisfies FileToUpload;
    });
    allFiles.push(...yamlFiles);
  }

  // Process Twilio Content JSON files
  if (filePaths.twilioContentJson) {
    const twilioContentJsonFiles = filePaths.twilioContentJson.map(
      (filePath) => {
        const content = readFile(filePath);

        const parsedJson = parseJson(
          content,
          filePath,
          additionalOptions,
          settings.defaultLocale
        );

        const relativePath = getRelative(filePath);

        return {
          content: parsedJson,
          fileName: relativePath,
          fileFormat: 'TWILIO_CONTENT_JSON' as const,
          dataFormat: 'STRING' as const,
          locale: settings.defaultLocale,
          fileId: hashStringSync(relativePath),
          versionId: hashStringSync(parsedJson),
        } satisfies FileToUpload;
      }
    );
    allFiles.push(...twilioContentJsonFiles);
  }

  for (const fileType of SUPPORTED_FILE_EXTENSIONS) {
    if (
      fileType === 'json' ||
      fileType === 'yaml' ||
      fileType === 'twilioContentJson'
    )
      continue;
    if (filePaths[fileType]) {
      const files = filePaths[fileType].map((filePath) => {
        const content = readFile(filePath);
        const sanitizedContent = sanitizeFileContent(content);
        const relativePath = getRelative(filePath);
        return {
          content: sanitizedContent,
          fileName: relativePath,
          fileFormat: fileType.toUpperCase() as FileFormat,
          dataFormat,
          locale: settings.defaultLocale,
          fileId: hashStringSync(relativePath),
          versionId: hashStringSync(sanitizedContent),
        } satisfies FileToUpload;
      });
      allFiles.push(...files);
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
    locales,
    settings.defaultLocale
  );

  // construct object
  const uploadData = allFiles.map((file) => {
    const sourceFile: FileToUpload = {
      content: file.content,
      fileName: file.fileName,
      fileFormat: file.fileFormat,
      dataFormat: file.dataFormat,
      locale: file.locale,
      fileId: file.fileId,
      versionId: file.versionId,
    };

    const translations: FileToUpload[] = [];
    const compositeInfo = compositeJsonFiles.get(file.fileName);

    for (const locale of locales) {
      if (compositeInfo) {
        // Composite JSON: extract translations from the same source file
        const extracted = extractJson(
          compositeInfo.content,
          compositeInfo.filePath,
          additionalOptions,
          locale,
          settings.defaultLocale
        );
        if (extracted) {
          translations.push({
            content: extracted,
            fileName: file.fileName,
            fileFormat: file.fileFormat,
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
          const translatedContent = readFileSync(translatedFileName, 'utf8');
          translations.push({
            content: translatedContent,
            fileName: file.fileName,
            fileFormat: file.fileFormat,
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
    const publishMap = buildPublishMap(filePaths, settings);
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
