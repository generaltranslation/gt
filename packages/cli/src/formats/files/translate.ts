import { checkFileTranslations } from '../../api/checkFileTranslations';
import { sendFiles } from '../../api/sendFiles';
import {
  noSupportedFormatError,
  logErrorAndExit,
  createSpinner,
  logError,
  logSuccess,
  noLocalesError,
  noDefaultLocaleError,
  noApiKeyError,
  noProjectIdError,
  devApiKeyError,
} from '../../console';
import { resolveLocaleFiles } from '../../fs/config/parseFilesConfig';
import { getRelative, readFile } from '../../fs/findFilepath';
import { flattenJsonDictionary } from '../../react/utils/flattenDictionary';
import { ResolvedFiles, Settings, TransformFiles } from '../../types';
import { FileExtension, DataFormat } from '../../types/data';
import path from 'node:path';
import chalk from 'chalk';
import { downloadFile } from '../../api/downloadFile';
import { downloadFileBatch } from '../../api/downloadFileBatch';
import { SUPPORTED_FILE_EXTENSIONS } from './supportedFiles';
import { TranslateOptions } from '../../cli/base';
const SUPPORTED_FORMATS = ['JSX', 'ICU', 'I18NEXT'];

/**
 * Sends multiple files to the API for translation
 * @param filePaths - Resolved file paths for different file types
 * @param placeholderPaths - Placeholder paths for translated files
 * @param transformPaths - Transform paths for file naming
 * @param dataFormat - Format of the data within the files
 * @param options - Translation options including API settings
 * @returns Promise that resolves when translation is complete
 */
export async function translateFiles(
  filePaths: ResolvedFiles,
  placeholderPaths: ResolvedFiles,
  transformPaths: TransformFiles,
  dataFormat: DataFormat = 'JSX',
  options: Settings & TranslateOptions
): Promise<void> {
  // Collect all files to translate
  const allFiles = [];

  // Process JSON files
  if (filePaths.json) {
    if (!SUPPORTED_FORMATS.includes(dataFormat)) {
      logErrorAndExit(noSupportedFormatError);
    }

    const jsonFiles = filePaths.json.map((filePath) => {
      const content = readFile(filePath);
      const json = JSON.parse(content);

      // Just to validate the JSON is valid
      flattenJsonDictionary(json);

      const relativePath = getRelative(filePath);
      return {
        content,
        fileName: relativePath,
        fileExtension: 'JSON' as FileExtension,
        dataFormat,
      };
    });
    allFiles.push(...jsonFiles);
  }

  for (const fileType of SUPPORTED_FILE_EXTENSIONS) {
    if (fileType === 'json') continue;
    if (filePaths[fileType]) {
      const files = filePaths[fileType].map((filePath) => {
        const content = readFile(filePath);
        const relativePath = getRelative(filePath);
        return {
          content,
          fileName: relativePath,
          fileExtension: fileType.toUpperCase() as FileExtension,
          dataFormat,
        };
      });
      allFiles.push(...files);
    }
  }

  if (allFiles.length === 0) {
    logError(
      'No files to translate were found. Please check your configuration and try again.'
    );
    return;
  }
  if (options.dryRun) {
    const fileNames = allFiles.map((file) => `- ${file.fileName}`).join('\n');
    logSuccess(
      `Dry run: No files were sent to General Translation. Found files:\n${fileNames}`
    );
    return;
  }

  // Validate required settings are present
  if (!options.locales) {
    logErrorAndExit(noLocalesError);
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

  try {
    // Send all files in a single API call
    const response = await sendFiles(allFiles, {
      ...options,
      publish: false,
      wait: true,
    });

    const { data, locales, translations } = response;

    // Create file mapping for all file types
    const fileMapping = createFileMapping(
      filePaths,
      placeholderPaths,
      transformPaths,
      locales
    );

    // Process any translations that were already completed and returned with the initial response
    const downloadStatus = await processInitialTranslations(
      translations,
      fileMapping,
      options
    );

    // Check for remaining translations
    await checkFileTranslations(
      options.apiKey,
      options.baseUrl,
      data,
      locales,
      600,
      (sourcePath, locale) => fileMapping[locale][sourcePath],
      downloadStatus // Pass the already downloaded files to avoid duplicate requests
    );
  } catch (error) {
    logErrorAndExit(`Error translating files: ${error}`);
  }
}

/**
 * Creates a mapping between source files and their translated counterparts for each locale
 */
function createFileMapping(
  filePaths: ResolvedFiles,
  placeholderPaths: ResolvedFiles,
  transformPaths: TransformFiles,
  locales: string[]
): Record<string, Record<string, string>> {
  const fileMapping: Record<string, Record<string, string>> = {};

  for (const locale of locales) {
    const translatedPaths = resolveLocaleFiles(placeholderPaths, locale);
    const localeMapping: Record<string, string> = {};

    // Process each file type
    for (const typeIndex of SUPPORTED_FILE_EXTENSIONS) {
      if (!filePaths[typeIndex] || !translatedPaths[typeIndex]) continue;

      const sourcePaths = filePaths[typeIndex];
      let translatedFiles = translatedPaths[typeIndex];
      if (!translatedFiles) continue;

      const transformPath = transformPaths[typeIndex];
      if (transformPath) {
        translatedFiles = translatedFiles.map((filePath) => {
          const directory = path.dirname(filePath);
          const fileName = path.basename(filePath);
          const baseName = fileName.split('.')[0];
          const transformedFileName = transformPath
            .replace('*', baseName)
            .replace('[locale]', locale);
          return path.join(directory, transformedFileName);
        });
      }

      for (let i = 0; i < sourcePaths.length; i++) {
        const sourceFile = getRelative(sourcePaths[i]);
        const translatedFile = getRelative(translatedFiles[i]);
        localeMapping[sourceFile] = translatedFile;
      }
    }

    fileMapping[locale] = localeMapping;
  }

  return fileMapping;
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
          fileLocale: `${fileName}:${locale}`,
        };
      })
      .filter(Boolean);

    if (batchFiles.length === 0 || batchFiles[0] === null) {
      return downloadStatus;
    }

    // Use batch download if there are multiple files
    if (batchFiles.length > 1) {
      const batchResult = await downloadFileBatch(
        options.baseUrl,
        options.apiKey,
        batchFiles.map(({ translationId, outputPath }: any) => ({
          translationId,
          outputPath,
        }))
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
        options.baseUrl,
        options.apiKey,
        file.translationId,
        file.outputPath
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
