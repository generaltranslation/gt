import { ResolvedFiles, TransformFiles } from '../../types/index.js';
import { SUPPORTED_FILE_EXTENSIONS } from '../files/supportedFiles.js';
import { resolveLocaleFiles } from '../../fs/config/parseFilesConfig.js';
import path from 'node:path';
import { getRelative } from '../../fs/findFilepath.js';
import { getLocaleProperties } from 'generaltranslation';
import { replaceLocalePlaceholders } from '../utils.js';
import { FileMapping } from '../../types/files.js';
import { TEMPLATE_FILE_NAME } from '../../cli/commands/stage.js';

/**
 * Creates a mapping between source files and their translated counterparts for each locale
 * @param filePaths - Resolved file paths for different file types
 * @param placeholderPaths - Placeholder paths for translated files
 * @param transformPaths - Transform paths for file naming
 * @param locales - List of locales to create a mapping for
 * @returns A mapping between source files and their translated counterparts for each locale, in the form of relative paths
 */
export function createFileMapping(
  filePaths: ResolvedFiles,
  placeholderPaths: ResolvedFiles,
  transformPaths: TransformFiles,
  targetLocales: string[],
  defaultLocale: string
): FileMapping {
  const fileMapping: FileMapping = {};

  for (const locale of targetLocales) {
    const translatedPaths = resolveLocaleFiles(placeholderPaths, locale);
    const localeMapping: FileMapping[string] = {};

    // Process each file type

    // Start with GTJSON Template files
    if (translatedPaths.gt) {
      const filepath = translatedPaths.gt;
      localeMapping[TEMPLATE_FILE_NAME] = filepath;
    }

    for (const typeIndex of SUPPORTED_FILE_EXTENSIONS) {
      if (!filePaths[typeIndex] || !translatedPaths[typeIndex]) continue;

      const sourcePaths = filePaths[typeIndex];
      let translatedFiles = translatedPaths[typeIndex];
      if (!translatedFiles) continue;

      const transformPath = transformPaths[typeIndex];

      if (transformPath) {
        if (typeof transformPath === 'string') {
          translatedFiles = translatedFiles.map((filePath) => {
            const directory = path.dirname(filePath);
            const fileName = path.basename(filePath);
            const baseName = fileName.split('.')[0];
            const transformedFileName = transformPath
              .replace('*', baseName)
              .replace('[locale]', locale);
            return path.join(directory, transformedFileName);
          });
        } else {
          // transformPath is an object
          const targetLocaleProperties = getLocaleProperties(locale);
          const defaultLocaleProperties = getLocaleProperties(defaultLocale);
          if (
            !transformPath.replace ||
            typeof transformPath.replace !== 'string'
          ) {
            continue;
          }
          // Replace all locale property placeholders
          const replaceString = replaceLocalePlaceholders(
            transformPath.replace,
            targetLocaleProperties
          );
          translatedFiles = translatedFiles.map((filePath) => {
            let relativePath = getRelative(filePath);
            if (
              transformPath.match &&
              typeof transformPath.match === 'string'
            ) {
              // Replace locale placeholders in the match string using defaultLocale properties
              let matchString = transformPath.match;
              matchString = replaceLocalePlaceholders(
                matchString,
                defaultLocaleProperties
              );

              relativePath = relativePath.replace(
                new RegExp(matchString, 'g'),
                replaceString
              );
            } else {
              relativePath = replaceString;
            }
            return path.resolve(relativePath);
          });
        }
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
