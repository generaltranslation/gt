import { checkFileTranslations } from '../../api/checkFileTranslations';
import { sendFiles } from '../../api/sendFiles';
import { noSupportedDataFormatError } from '../../console/errors';
import { resolveLocaleFiles } from '../../fs/config/parseFilesConfig';
import { getRelative, readFile } from '../../fs/findFilepath';
import { flattenJsonDictionary } from '../../react/utils/flattenDictionary';
import { ResolvedFiles, Settings, TransformFiles } from '../../types';
import { FileFormats, DataFormat } from '../../types/data';
import path from 'path';

const SUPPORTED_DATA_FORMATS = ['JSX', 'ICU', 'I18NEXT'];

/**
 * Sends multiple files to the API for translation
 * @param filePaths - Resolved file paths for different file types
 * @param placeholderPaths - Placeholder paths for translated files
 * @param transformPaths - Transform paths for file naming
 * @param fileFormat - Format of the files
 * @param dataFormat - Format of the data within the files
 * @param options - Translation options including API settings
 * @returns Promise that resolves when translation is complete
 */
export async function translateFiles(
  filePaths: ResolvedFiles,
  placeholderPaths: ResolvedFiles,
  transformPaths: TransformFiles,
  dataFormat: DataFormat = 'JSX',
  options: Settings
): Promise<void> {
  // Collect all files to translate
  const allFiles = [];

  // Process JSON files
  if (filePaths.json) {
    if (!SUPPORTED_DATA_FORMATS.includes(dataFormat)) {
      console.error(noSupportedDataFormatError);
      process.exit(1);
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
        fileFormat: 'JSON' as FileFormats,
        dataFormat,
      };
    });
    allFiles.push(...jsonFiles);
  }

  // Process MDX files
  if (filePaths.mdx) {
    const mdxFiles = filePaths.mdx.map((filePath) => {
      const content = readFile(filePath);
      const relativePath = getRelative(filePath);
      return {
        content,
        fileName: relativePath,
        fileFormat: 'MDX' as FileFormats,
        dataFormat,
      };
    });
    allFiles.push(...mdxFiles);
  }

  // Process MD files
  if (filePaths.md) {
    const mdFiles = filePaths.md.map((filePath) => {
      const content = readFile(filePath);
      const relativePath = getRelative(filePath);
      return {
        content,
        fileName: relativePath,
        fileFormat: 'MD' as FileFormats,
        dataFormat,
      };
    });
    allFiles.push(...mdFiles);
  }

  if (allFiles.length === 0) {
    console.error('No files to translate');
    return;
  }

  try {
    // Send all files in a single API call
    const response = await sendFiles(allFiles, {
      ...options,
      publish: false,
      wait: true,
    });

    const { data, locales } = response;

    // Create file mapping for all file types
    const fileMapping: Record<string, Record<string, string>> = {};
    for (const locale of locales) {
      const translatedPaths = resolveLocaleFiles(placeholderPaths, locale);
      const localeMapping: Record<string, string> = {};

      // Process each file type
      for (const typeIndex of ['json', 'mdx', 'md'] as const) {
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

    await checkFileTranslations(
      options.apiKey,
      options.baseUrl,
      data,
      locales,
      600,
      (sourcePath, locale) => {
        return fileMapping[locale][sourcePath];
      }
    );
  } catch (error) {
    console.error('Error translating files:', error);
  }
}
