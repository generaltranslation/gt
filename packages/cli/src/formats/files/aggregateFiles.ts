import { logger } from '../../console/logger.js';
import { recordWarning } from '../../state/translateWarnings.js';
import { getRelative, readFile } from '../../fs/findFilepath.js';
import { Settings } from '../../types/index.js';
import type { FileFormat, DataFormat, FileToUpload } from '../../types/data.js';
import { SUPPORTED_FILE_EXTENSIONS } from './supportedFiles.js';
import { parseJson } from '../json/parseJson.js';
import { detectMintlifyUnsupportedFields } from '../json/utils.js';
import path from 'node:path';
import parseYaml from '../yaml/parseYaml.js';
import { validateYamlSchema } from '../yaml/utils.js';
import { flattenJson } from '../json/flattenJson.js';
import type { JSONObject } from '../../types/data/json.js';
import YAML from 'yaml';
import { determineLibrary } from '../../fs/determineFramework/index.js';
import { hashStringSync } from '../../utils/hash.js';
import { preprocessContent } from './preprocessContent.js';
import {
  parseKeyedMetadata,
  type KeyedMetadata,
} from '../parseKeyedMetadata.js';
import { buildPublishMap } from '../../utils/resolvePublish.js';

/**
 * Checks if a file path is a metadata companion file (e.g. foo.metadata.json)
 * AND its corresponding source file (e.g. foo.json) exists in the file list.
 * If both conditions are true, the metadata file should be skipped as a translation source.
 */
function isCompanionMetadataFile(
  filePath: string,
  allFilePaths: string[]
): boolean {
  const metadataPattern = /\.metadata\.(json|yaml|yml)$/;
  if (!metadataPattern.test(filePath)) return false;

  // Derive the source file path: foo.metadata.json -> foo.json
  const sourceFilePath = filePath.replace(
    /\.metadata\.(json|yaml|yml)$/,
    '.$1'
  );
  return allFilePaths.includes(sourceFilePath);
}
export const SUPPORTED_DATA_FORMATS = ['JSX', 'ICU', 'I18NEXT'];

export async function aggregateFiles(
  settings: Settings
): Promise<{ files: FileToUpload[]; publishMap: Map<string, boolean> }> {
  // Aggregate all files to translate
  const files: FileToUpload[] = [];
  if (
    !settings.files ||
    (Object.keys(settings.files.placeholderPaths).length === 1 &&
      settings.files.placeholderPaths.gt)
  ) {
    return { files, publishMap: new Map<string, boolean>() };
  }

  const { resolvedPaths: filePaths } = settings.files;
  const skipValidation = settings.options?.skipFileValidation;

  // Build publish map upfront from resolved paths.
  const publishMap = buildPublishMap(filePaths, settings);

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
      .filter((filePath) => !isCompanionMetadataFile(filePath, filePaths.json!))
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
            detectMintlifyUnsupportedFields(JSON.parse(content), filePath);
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

        // Detect companion metadata file
        let keyedMetadata: KeyedMetadata | undefined;
        let parsedContent: JSONObject | undefined;
        try {
          parsedContent = JSON.parse(content) as JSONObject;
        } catch {
          // Content not parsable — skip metadata detection
        }
        if (parsedContent) {
          const rawMetadata = parseKeyedMetadata(filePath, parsedContent);
          if (rawMetadata) {
            // Run metadata through the same include/composite schema as the source
            // so key paths align at translation time
            const transformed = parseJson(
              JSON.stringify(rawMetadata),
              filePath,
              settings.options || {},
              settings.defaultLocale,
              false
            );
            const transformedMetadata = JSON.parse(transformed);

            // Filter metadata to only keep keys that exist in the transformed source
            // This prevents misaligned entries from wide JSONPath patterns
            const sourceKeys = new Set(Object.keys(JSON.parse(parsedJson)));
            const filtered = Object.fromEntries(
              Object.entries(transformedMetadata).filter(([k]) =>
                sourceKeys.has(k)
              )
            ) as KeyedMetadata;

            if (Object.keys(filtered).length > 0) {
              keyedMetadata = filtered;
            } else {
              logger.warn(
                `Companion metadata found for ${relativePath} but no keys aligned with the JSON schema — metadata was not attached`
              );
            }
          }
        }

        return {
          fileId: hashStringSync(relativePath),
          versionId: hashStringSync(parsedJson),
          content: parsedJson,
          fileName: relativePath,
          fileFormat: 'JSON' as const,
          dataFormat,
          locale: settings.defaultLocale,
          ...(keyedMetadata && {
            formatMetadata: { keyedMetadata },
          }),
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
    files.push(...jsonFiles.filter((file) => file !== null));
  }

  // Process YAML files
  if (filePaths.yaml) {
    const yamlFiles = filePaths.yaml
      .filter((filePath) => !isCompanionMetadataFile(filePath, filePaths.yaml!))
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

        // Detect companion metadata file
        let keyedMetadata: KeyedMetadata | undefined;
        try {
          const parsedYamlContent = YAML.parse(content);
          const rawMetadata = parseKeyedMetadata(filePath, parsedYamlContent);
          if (rawMetadata) {
            const yamlSchema = validateYamlSchema(
              settings.options || {},
              filePath
            );
            if (yamlSchema?.include) {
              // Flatten metadata through the same include schema as the source
              const flattened = flattenJson(rawMetadata, yamlSchema.include);
              // Filter to only keep keys that exist in the transformed source
              const sourceKeys = new Set(Object.keys(JSON.parse(parsedYaml)));
              const filtered = Object.fromEntries(
                Object.entries(flattened).filter(([k]) => sourceKeys.has(k))
              ) as KeyedMetadata;
              if (Object.keys(filtered).length > 0) {
                keyedMetadata = filtered;
              } else {
                logger.warn(
                  `Companion metadata found for ${relativePath} but no keys aligned with the YAML schema — metadata was not attached`
                );
              }
            } else {
              keyedMetadata = rawMetadata;
            }
          }
        } catch {
          // Content not parsable as YAML — skip metadata detection
        }

        return {
          content: parsedYaml,
          fileName: relativePath,
          fileFormat,
          fileId: hashStringSync(relativePath),
          versionId: hashStringSync(parsedYaml),
          locale: settings.defaultLocale,
          ...(keyedMetadata && {
            formatMetadata: { keyedMetadata },
          }),
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
    files.push(...yamlFiles.filter((file) => file !== null));
  }

  // Process Twilio Content JSON files
  if (filePaths.twilioContentJson) {
    const twilioContentJsonFiles = filePaths.twilioContentJson
      .map((filePath) => {
        const content = readFile(filePath);
        const relativePath = getRelative(filePath);

        // Pre-validate JSON parseability
        if (!skipValidation?.json) {
          try {
            JSON.parse(content);
          } catch {
            logger.warn(`Skipping ${relativePath}: JSON file is not parsable`);
            recordWarning(
              'skipped_file',
              relativePath,
              'JSON file is not parsable'
            );
            return null;
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
          fileFormat: 'TWILIO_CONTENT_JSON' as const,
          dataFormat: 'STRING' as const,
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
    files.push(...twilioContentJsonFiles.filter((file) => file !== null));
  }

  for (const fileType of SUPPORTED_FILE_EXTENSIONS) {
    if (
      fileType === 'json' ||
      fileType === 'yaml' ||
      fileType === 'twilioContentJson'
    )
      continue;
    if (filePaths[fileType]) {
      const parsed = filePaths[fileType]
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
            versionId: hashStringSync(processed),
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
      files.push(...parsed.filter((file) => file !== null));
    }
  }

  if (files.length === 0 && !settings.publish) {
    logger.error(
      'No files to translate were found. Check your configuration and try again.'
    );
  }

  // Remove stale entries for files that were skipped during validation
  const validFileIds = new Set(files.map((f) => f.fileId));
  for (const fileId of publishMap.keys()) {
    if (!validFileIds.has(fileId)) {
      publishMap.delete(fileId);
    }
  }

  return { files, publishMap };
}
