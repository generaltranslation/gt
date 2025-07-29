import {
  noSupportedFormatError,
  noDefaultLocaleError,
  noApiKeyError,
  noProjectIdError,
  devApiKeyError,
} from '../../console/index.js';
import {
  logErrorAndExit,
  createSpinner,
  logError,
} from '../../console/logging.js';
import { getRelative, readFile } from '../../fs/findFilepath.js';
import { ResolvedFiles, Settings, TransformFiles } from '../../types/index.js';
import { FileFormat, DataFormat } from '../../types/data.js';
import chalk from 'chalk';
import { downloadFile } from '../../api/downloadFile.js';
import { downloadFileBatch } from '../../api/downloadFileBatch.js';
import { SUPPORTED_FILE_EXTENSIONS } from './supportedFiles.js';
import { UploadOptions } from '../../cli/base.js';
import sanitizeFileContent from '../../utils/sanitizeFileContent.js';
import { parseJson } from '../json/parseJson.js';
import { FileUpload, uploadFiles } from '../../api/uploadFiles.js';
import { existsSync, readFileSync } from 'node:fs';
import { createFileMapping } from './fileMapping.js';
import parseYaml from '../yaml/parseYaml.js';

const SUPPORTED_DATA_FORMATS = ['JSX', 'ICU', 'I18NEXT'];

/**
 * Sends multiple files to the API for translation
 * @param filePaths - Resolved file paths for different file types
 * @param placeholderPaths - Placeholder paths for translated files
 * @param transformPaths - Transform paths for file naming
 * @param dataFormat - Format of the data within the files
 * @param options - Translation options including API settings
 * @returns Promise that resolves when translation is complete
 */
export async function upload(
  filePaths: ResolvedFiles,
  placeholderPaths: ResolvedFiles,
  transformPaths: TransformFiles,
  dataFormat: DataFormat = 'JSX',
  options: Settings & UploadOptions
): Promise<void> {
  // Collect all files to translate
  const allFiles: FileUpload[] = [];
  const additionalOptions = options.options || {};

  // Process JSON files
  if (filePaths.json) {
    if (!SUPPORTED_DATA_FORMATS.includes(dataFormat)) {
      logErrorAndExit(noSupportedFormatError);
    }

    const jsonFiles = filePaths.json.map((filePath) => {
      const content = readFile(filePath);

      const parsedJson = parseJson(
        content,
        filePath,
        additionalOptions,
        options.defaultLocale
      );

      const relativePath = getRelative(filePath);
      return {
        content: parsedJson,
        fileName: relativePath,
        fileFormat: 'JSON' as FileFormat,
        dataFormat,
        locale: options.defaultLocale,
      };
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
      const parsedYaml = parseYaml(content, filePath, additionalOptions);

      const relativePath = getRelative(filePath);
      return {
        content: parsedYaml,
        fileName: relativePath,
        fileFormat: 'JSON' as FileFormat, // Translate as a JSON file
        dataFormat,
        locale: options.defaultLocale,
      };
    });
    allFiles.push(...yamlFiles);
  }

  for (const fileType of SUPPORTED_FILE_EXTENSIONS) {
    if (fileType === 'json' || fileType === 'yaml') continue;
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
          locale: options.defaultLocale,
        };
      });
      allFiles.push(...files);
    }
  }

  if (allFiles.length === 0) {
    logError(
      'No files to upload were found. Please check your configuration and try again.'
    );
    return;
  }

  if (!options.defaultLocale) {
    logErrorAndExit(noDefaultLocaleError);
  }
  if (!options.apiKey) {
    logErrorAndExit(noApiKeyError);
  }
  if (options.apiKey.startsWith('gtx-dev-')) {
    logErrorAndExit(devApiKeyError);
  }
  if (!options.projectId) {
    logErrorAndExit(noProjectIdError);
  }

  const locales = options.locales || [];
  // Create file mapping for all file types
  const fileMapping = createFileMapping(
    filePaths,
    placeholderPaths,
    transformPaths,
    locales,
    options.defaultLocale
  );

  // construct object
  const uploadData = allFiles.map((file) => {
    const encodedContent = Buffer.from(file.content).toString('base64');
    const sourceFile: FileUpload = {
      content: encodedContent,
      fileName: file.fileName,
      fileFormat: file.fileFormat,
      dataFormat: file.dataFormat,
      locale: file.locale,
    };

    const translations: FileUpload[] = [];
    for (const locale of locales) {
      const translatedFileName = fileMapping[locale][file.fileName];
      if (translatedFileName && existsSync(translatedFileName)) {
        const translatedContent = readFileSync(translatedFileName, 'utf8');
        const encodedTranslatedContent =
          Buffer.from(translatedContent).toString('base64');
        translations.push({
          content: encodedTranslatedContent,
          fileName: translatedFileName,
          fileFormat: file.fileFormat,
          dataFormat: file.dataFormat,
          locale,
        });
      }
    }
    return {
      source: sourceFile,
      translations,
    };
  });

  try {
    // Send all files in a single API call
    const response = await uploadFiles(uploadData, options);
  } catch (error) {
    logErrorAndExit(`Error uploading files: ${error}`);
  }
}

/**
 * Processes translations that were already completed and returned with the initial API response
 * @returns Set of downloaded file+locale combinations
 */
async function processInitialTranslations(
  translations: any[] = [],
  fileMapping: Record<string, Record<string, string>>,
  options: Settings
): Promise<{ downloaded: Set<string>; failed: Set<string> }> {
  const downloadStatus: { downloaded: Set<string>; failed: Set<string> } = {
    downloaded: new Set(),
    failed: new Set(),
  };

  if (!translations || translations.length === 0) {
    return downloadStatus;
  }

  // Filter for ready translations
  const readyTranslations = translations.filter(
    (translation) => translation.isReady && translation.fileName
  );

  if (readyTranslations.length > 0) {
    const spinner = createSpinner('dots');
    spinner.start('Downloading translations...');

    // Prepare batch download data
    const batchFiles = readyTranslations
      .map((translation) => {
        const { locale, fileName, id } = translation;
        const outputPath = fileMapping[locale][fileName];

        if (!outputPath) {
          return null;
        }

        return {
          translationId: id,
          outputPath,
          inputPath: fileName,
          fileLocale: `${fileName}:${locale}`,
          locale,
        };
      })
      .filter(Boolean);

    if (batchFiles.length === 0 || batchFiles[0] === null) {
      return downloadStatus;
    }

    // Use batch download if there are multiple files
    if (batchFiles.length > 1) {
      const batchResult = await downloadFileBatch(
        batchFiles.map(
          ({ translationId, outputPath, inputPath, locale }: any) => ({
            translationId,
            outputPath,
            inputPath,
            locale,
          })
        ),
        options
      );

      // Process results
      batchFiles.forEach((file: any) => {
        const { translationId, fileLocale } = file;
        if (batchResult.successful.includes(translationId)) {
          downloadStatus.downloaded.add(fileLocale);
        } else if (batchResult.failed.includes(translationId)) {
          downloadStatus.failed.add(fileLocale);
        }
      });
    } else if (batchFiles.length === 1) {
      // For a single file, use the original downloadFile method
      const file = batchFiles[0];
      const result = await downloadFile(
        file.translationId,
        file.outputPath,
        file.inputPath,
        file.locale,
        options
      );

      if (result) {
        downloadStatus.downloaded.add(file.fileLocale);
      } else {
        downloadStatus.failed.add(file.fileLocale);
      }
    }

    spinner.stop(chalk.green('Downloaded cached translations'));
  }

  return downloadStatus;
}
