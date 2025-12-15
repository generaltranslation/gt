import { logger } from '../../console/logger.js';
import { getRelative, readFile } from '../../fs/findFilepath.js';
import { Settings } from '../../types/index.js';
import type { FileFormat, DataFormat, FileToUpload } from '../../types/data.js';
import { SUPPORTED_FILE_EXTENSIONS } from './supportedFiles.js';
import sanitizeFileContent from '../../utils/sanitizeFileContent.js';
import { parseJson } from '../json/parseJson.js';
import parseYaml from '../yaml/parseYaml.js';
import YAML from 'yaml';
import { determineLibrary } from '../../fs/determineFramework.js';
import { isValidMdx } from '../../utils/validateMdx.js';
import { hashStringSync } from '../../utils/hash.js';
export const SUPPORTED_DATA_FORMATS = ['JSX', 'ICU', 'I18NEXT'];

export async function aggregateFiles(
  settings: Settings
): Promise<FileToUpload[]> {
  // Aggregate all files to translate
  const allFiles: FileToUpload[] = [];
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
          logger.warn(`Skipping ${relativePath}: JSON file is not parsable`);
          return null;
        }

        const parsedJson = parseJson(
          content,
          filePath,
          settings.options || {},
          settings.defaultLocale
        );

        return {
          fileId: hashStringSync(relativePath),
          versionId: hashStringSync(parsedJson),
          content: parsedJson,
          fileName: relativePath,
          fileFormat: 'JSON' as const,
          dataFormat,
          locale: settings.defaultLocale,
        } satisfies FileToUpload;
      })
      .filter((file) => {
        if (!file) return false;
        if (typeof file.content !== 'string' || !file.content.trim()) {
          logger.warn(`Skipping ${file.fileName}: JSON file is empty`);
          return false;
        }
        return true;
      });
    allFiles.push(...jsonFiles.filter((file) => file !== null));
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
          logger.warn(`Skipping ${relativePath}: YAML file is not parsable`);
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
          fileId: hashStringSync(relativePath),
          versionId: hashStringSync(parsedYaml),
          locale: settings.defaultLocale,
        } satisfies FileToUpload;
      })
      .filter((file) => {
        if (!file || typeof file.content !== 'string' || !file.content.trim()) {
          logger.warn(
            `Skipping ${file?.fileName ?? 'unknown'}: YAML file is empty`
          );
          return false;
        }
        return true;
      });
    allFiles.push(...yamlFiles.filter((file) => file !== null));
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
              logger.warn(
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
            fileId: hashStringSync(relativePath),
            versionId: hashStringSync(content),
            locale: settings.defaultLocale,
          } satisfies FileToUpload;
        })
        .filter((file) => {
          if (
            !file ||
            typeof file.content !== 'string' ||
            !file.content.trim()
          ) {
            logger.warn(
              `Skipping ${file?.fileName ?? 'unknown'}: File is empty after sanitization`
            );
            return false;
          }
          return true;
        });
      allFiles.push(...files.filter((file) => file !== null));
    }
  }

  if (allFiles.length === 0 && !settings.publish) {
    logger.error(
      'No files to translate were found. Please check your configuration and try again.'
    );
  }

  return allFiles;
}
