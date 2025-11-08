import { logError, logWarning } from '../../console/logging.js';
import { getRelative, readFile } from '../../fs/findFilepath.js';
import { Settings } from '../../types/index.js';
import { FileFormat, DataFormat, FileToTranslate } from '../../types/data.js';
import { SUPPORTED_FILE_EXTENSIONS } from './supportedFiles.js';
import sanitizeFileContent from '../../utils/sanitizeFileContent.js';
import { parseJson } from '../json/parseJson.js';
import parseYaml from '../yaml/parseYaml.js';
import YAML from 'yaml';
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

        // Pre-validate JSON parseability
        try {
          JSON.parse(content);
        } catch (e: any) {
          logWarning(`Skipping ${relativePath}: JSON file is not parsable`);
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
        } as FileToTranslate;
      })
      .filter((file): file is FileToTranslate => {
        if (!file) return false;
        if (typeof file.content !== 'string' || !file.content.trim()) {
          logWarning(`Skipping ${file.fileName}: JSON file is empty`);
          return false;
        }
        return true;
      });
    allFiles.push(...jsonFiles);
  }

  // Process YAML files
  if (filePaths.yaml) {
    const yamlFiles = filePaths.yaml
      .map((filePath) => {
        const content = readFile(filePath);
        const relativePath = getRelative(filePath);

        // Pre-validate YAML parseability
        try {
          YAML.parse(content);
        } catch (e: any) {
          logWarning(`Skipping ${relativePath}: YAML file is not parsable`);
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
        } as FileToTranslate;
      })
      .filter((file): file is FileToTranslate => {
        if (!file) return false;
        if (typeof file.content !== 'string' || !file.content.trim()) {
          logWarning(`Skipping ${file.fileName}: YAML file is empty`);
          return false;
        }
        return true;
      });
    allFiles.push(...yamlFiles);
  }

  for (const fileType of SUPPORTED_FILE_EXTENSIONS) {
    if (fileType === 'json' || fileType === 'yaml') continue;
    if (filePaths[fileType]) {
      const files = filePaths[fileType]
        .map((filePath) => {
          const content = readFile(filePath);
          const relativePath = getRelative(filePath);

          if (fileType === 'mdx') {
            const validation = isValidMdx(content, filePath);
            if (!validation.isValid) {
              logWarning(
                `Skipping ${relativePath}: MDX file is not AST parsable${validation.error ? `: ${validation.error}` : ''}`
              );
              return null;
            }
          }

          const sanitizedContent = sanitizeFileContent(content);
          return {
            content: sanitizedContent,
            fileName: relativePath,
            fileFormat: fileType.toUpperCase() as FileFormat,
          } as FileToTranslate | null;
        })
        .filter((file): file is FileToTranslate => {
          if (
            !file ||
            typeof file.content !== 'string' ||
            !file.content.trim()
          ) {
            logWarning(
              `Skipping ${file?.fileName ?? 'unknown'}: File is empty after sanitization`
            );
            return false;
          }
          return true;
        });
      allFiles.push(...files);
    }
  }

  if (allFiles.length === 0 && !settings.publish) {
    logError(
      'No files to translate were found. Please check your configuration and try again.'
    );
  }

  return allFiles;
}
