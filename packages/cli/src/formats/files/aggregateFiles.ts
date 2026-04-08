import { logger } from '../../console/logger.js';
import { recordWarning } from '../../state/translateWarnings.js';
import { getRelative, readFile } from '../../fs/findFilepath.js';
import { Settings } from '../../types/index.js';
import type { FileFormat, DataFormat, FileToUpload } from '../../types/data.js';
import { SUPPORTED_FILE_EXTENSIONS } from './supportedFiles.js';
import { parseJson } from '../json/parseJson.js';
import { detectUnsupportedJsonFields } from '../json/utils.js';
import path from 'node:path';
import parseYaml from '../yaml/parseYaml.js';
import YAML from 'yaml';
import { determineLibrary } from '../../fs/determineFramework.js';
import { hashStringSync } from '../../utils/hash.js';
import { preprocessContent } from './preprocessContent.js';
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
  const skipValidation = settings.options?.skipFileValidation;

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
      dataFormat = 'STRING';
    }

    const jsonFiles = filePaths.json
      .map((filePath) => {
        const content = readFile(filePath);
        const relativePath = getRelative(filePath);

        // Pre-validate JSON parseability
        if (!skipValidation?.json) {
          try {
            JSON.parse(content);
          } catch (e: any) {
            logger.warn(`Skipping ${relativePath}: JSON file is not parsable`);
            recordWarning(
              'skipped_file',
              relativePath,
              'JSON file is not parsable'
            );
            return null;
          }
        }

        // Detect unsupported fields in Mintlify docs.json
        if (
          settings.framework === 'mintlify' &&
          path.basename(filePath) === 'docs.json'
        ) {
          try {
            detectUnsupportedJsonFields(JSON.parse(content), filePath);
          } catch {
            // JSON parse errors are handled below by parseJson
          }
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
          recordWarning('skipped_file', file.fileName, 'JSON file is empty');
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
        if (!skipValidation?.yaml) {
          try {
            YAML.parse(content);
          } catch (e: any) {
            logger.warn(`Skipping ${relativePath}: YAML file is not parsable`);
            recordWarning(
              'skipped_file',
              relativePath,
              'YAML file is not parsable'
            );
            return null;
          }
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
          recordWarning(
            'skipped_file',
            file?.fileName ?? 'unknown',
            'YAML file is empty'
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

          const processed = preprocessContent(
            content,
            relativePath,
            fileType,
            settings
          );

          if (typeof processed !== 'string') {
            logger.warn(`Skipping ${relativePath}: ${processed.skip}`);
            recordWarning('skipped_file', relativePath, processed.skip);
            return null;
          }

          return {
            content: processed,
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
            recordWarning(
              'skipped_file',
              file?.fileName ?? 'unknown',
              'File is empty after sanitization'
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
