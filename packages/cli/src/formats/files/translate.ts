import { checkFileTranslations } from '../../api/checkFileTranslations';
import { sendFiles } from '../../api/sendFiles';
import { resolveLocaleFiles } from '../../fs/config/parseFilesConfig';
import { getRelative, readFile } from '../../fs/findFilepath';
import { ResolvedFiles, Settings, TransformFiles } from '../../types';
import { FileFormats } from '../../types/data';
import path from 'path';
/**
 * Sends an entire file to the API for translation
 * @param fileContent - The raw content of the file to translate
 * @param options - Translation options including API settings
 * @returns The translated file content or null if translation failed
 */
export async function translateFiles(
  filePaths: ResolvedFiles,
  placeholderPaths: ResolvedFiles,
  transformPaths: TransformFiles,
  fileFormat: FileFormats,
  options: Settings
): Promise<void> {
  let typeIndex: keyof ResolvedFiles = 'json';
  if (fileFormat === 'MDX') {
    typeIndex = 'mdx';
  } else if (fileFormat === 'MD') {
    typeIndex = 'md';
  } else if (fileFormat === 'JSON') {
    typeIndex = 'json';
  }
  const sourcePaths = filePaths[typeIndex];

  try {
    if (!sourcePaths) {
      console.error('No files to translate');
      return;
    }
    const files = sourcePaths.map((filePath) => {
      const content = readFile(filePath);
      const relativePath = getRelative(filePath);
      return {
        content,
        fileName: relativePath,
        fileFormat,
      };
    });

    const response = await sendFiles(files, {
      ...options,
      publish: false,
      wait: true,
    });

    const { data, locales } = response;

    const fileMapping: Record<string, Record<string, string>> = {};
    for (const locale of locales) {
      const translatedPaths = resolveLocaleFiles(placeholderPaths, locale);
      let translatedFiles = translatedPaths[typeIndex];
      if (!translatedFiles) {
        continue; // shouldn't happen; typing
      }
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
      const localeMapping: Record<string, string> = {};
      for (let i = 0; i < sourcePaths.length; i++) {
        const sourceFile = getRelative(sourcePaths[i]);
        const translatedFile = getRelative(translatedFiles[i]);
        localeMapping[sourceFile] = translatedFile;
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
    console.error('Error translating file:', error);
  }
}
