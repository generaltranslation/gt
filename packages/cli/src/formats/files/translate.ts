import { logError } from '../../console/logging.js';
import { getRelative, readFile } from '../../fs/findFilepath.js';
import { Settings } from '../../types/index.js';
import { FileFormat, DataFormat, FileToTranslate } from '../../types/data.js';
import { SUPPORTED_FILE_EXTENSIONS } from './supportedFiles.js';
import sanitizeFileContent from '../../utils/sanitizeFileContent.js';
import { parseJson } from '../json/parseJson.js';
import parseYaml from '../yaml/parseYaml.js';
import { determineLibrary } from '../../fs/determineFramework.js';
import { addExplicitAnchorIds, extractHeadingInfo } from '../../utils/addExplicitAnchorIds.js';

export const SUPPORTED_DATA_FORMATS = ['JSX', 'ICU', 'I18NEXT'];

export async function aggregateFiles(
  settings: Settings
): Promise<FileToTranslate[]> {
  // Aggregate all files to translate
  const allFiles: FileToTranslate[] = [];
  if (
    !settings.files ||
    (Object.keys(settings.files.placeholderPaths).length === 1 &&
      settings.files.placeholderPaths.gt)
  ) {
    return allFiles;
  }

  const { resolvedPaths: filePaths } = settings.files;

  // Process JSON files
  if (filePaths.json) {
    const { library, additionalModules } = determineLibrary();

    // Determine dataFormat for JSONs
    let dataFormat: DataFormat;
    if (library === 'next-intl') {
      dataFormat = 'ICU';
    } else if (library === 'i18next') {
      if (additionalModules.includes('i18next-icu')) {
        dataFormat = 'ICU';
      } else {
        dataFormat = 'I18NEXT';
      }
    } else {
      dataFormat = 'JSX';
    }

    const jsonFiles = filePaths.json.map((filePath) => {
      const content = readFile(filePath);

      const parsedJson = parseJson(
        content,
        filePath,
        settings.options || {},
        settings.defaultLocale
      );

      const relativePath = getRelative(filePath);
      return {
        content: parsedJson,
        fileName: relativePath,
        fileFormat: 'JSON' as const,
        dataFormat,
      };
    });
    allFiles.push(...jsonFiles);
  }

  // Process YAML files
  if (filePaths.yaml) {
    const yamlFiles = filePaths.yaml.map((filePath) => {
      const content = readFile(filePath);
      const { content: parsedYaml, fileFormat } = parseYaml(
        content,
        filePath,
        settings.options || {}
      );

      const relativePath = getRelative(filePath);
      return {
        content: parsedYaml,
        fileName: relativePath,
        fileFormat,
      };
    });
    allFiles.push(...yamlFiles);
  }

  for (const fileType of SUPPORTED_FILE_EXTENSIONS) {
    if (fileType === 'json' || fileType === 'yaml') continue;
    if (filePaths[fileType]) {
      const files = filePaths[fileType].map((filePath) => {
        let content = readFile(filePath);

        // Apply preprocessor to add explicit anchor IDs for md/mdx files
        if (
          (fileType === 'md' || fileType === 'mdx') &&
          settings.options?.experimentalLocalizeStaticUrls
        ) {
          const sourceHeadingMap = extractHeadingInfo(content);
          const result = addExplicitAnchorIds(content, sourceHeadingMap, settings);
          if (result.hasChanges) {
            content = result.content;
          }
        }

        const sanitizedContent = sanitizeFileContent(content);
        const relativePath = getRelative(filePath);
        return {
          content: sanitizedContent,
          fileName: relativePath,
          fileFormat: fileType.toUpperCase() as FileFormat,
        };
      });
      allFiles.push(...files);
    }
  }

  if (allFiles.length === 0) {
    logError(
      'No files to translate were found. Please check your configuration and try again.'
    );
  }

  return allFiles;
}
