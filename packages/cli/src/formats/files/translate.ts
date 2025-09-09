import { logError, logWarning } from '../../console/logging.js';
import { getRelative, readFile } from '../../fs/findFilepath.js';
import { Settings } from '../../types/index.js';
import { FileFormat, DataFormat, FileToTranslate } from '../../types/data.js';
import { SUPPORTED_FILE_EXTENSIONS } from './supportedFiles.js';
import sanitizeFileContent from '../../utils/sanitizeFileContent.js';
import { parseJson } from '../json/parseJson.js';
import parseYaml from '../yaml/parseYaml.js';
import { determineLibrary } from '../../fs/determineFramework.js';
import { isValidMdx } from '../../utils/validateMdx.js';

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

    const jsonFiles = filePaths.json
      .map((filePath) => {
        const content = readFile(filePath);
        const relativePath = getRelative(filePath);

        // Skip empty files early to avoid failing the whole job
        if (!content || !content.trim()) {
          logWarning(`Skipping ${relativePath}: empty file`);
          return null;
        }

        const parsedJson = parseJson(
          content,
          filePath,
          settings.options || {},
          settings.defaultLocale
        );

        return {
          content: parsedJson,
          fileName: relativePath,
          fileFormat: 'JSON' as const,
          dataFormat,
        };
      })
      .filter((file): file is NonNullable<typeof file> => file !== null);
    allFiles.push(...jsonFiles);
  }

  // Process YAML files
  if (filePaths.yaml) {
    const yamlFiles = filePaths.yaml
      .map((filePath) => {
        const content = readFile(filePath);
        const relativePath = getRelative(filePath);

        // Skip empty files early to avoid failing the whole job
        if (!content || !content.trim()) {
          logWarning(`Skipping ${relativePath}: empty file`);
          return null;
        }

        const { content: parsedYaml, fileFormat } = parseYaml(
          content,
          filePath,
          settings.options || {}
        );

        return {
          content: parsedYaml,
          fileName: relativePath,
          fileFormat,
        };
      })
      .filter((file): file is NonNullable<typeof file> => file !== null);
    allFiles.push(...yamlFiles);
  }

  for (const fileType of SUPPORTED_FILE_EXTENSIONS) {
    if (fileType === 'json' || fileType === 'yaml') continue;
    if (filePaths[fileType]) {
      const files = filePaths[fileType]
        .map((filePath) => {
          const content = readFile(filePath);
          const relativePath = getRelative(filePath);

          // Skip empty files early to avoid failing the whole job
          if (!content || !content.trim()) {
            logWarning(`Skipping ${relativePath}: empty file`);
            return null;
          }

          if (fileType === 'mdx') {
            const validation = isValidMdx(content, filePath);
            if (!validation.isValid) {
              const errorMsg = validation.error ? `: ${validation.error}` : '';
              logWarning(
                `Skipping ${relativePath}: MDX file is not AST parsable${errorMsg}`
              );
              return null;
            }
          }

          const sanitizedContent = sanitizeFileContent(content);
          if (!sanitizedContent || !sanitizedContent.trim()) {
            logWarning(
              `Skipping ${relativePath}: empty file after sanitization`
            );
            return null;
          }

          return {
            content: sanitizedContent,
            fileName: relativePath,
            fileFormat: fileType.toUpperCase() as FileFormat,
          };
        })
        .filter((file): file is NonNullable<typeof file> => file !== null);
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
