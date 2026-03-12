import fs from 'node:fs';
import path from 'node:path';
import YAML from 'yaml';
import { logger } from '../console/logger.js';
import { exitSync } from '../console/logging.js';
import type { SourceCode } from '../react/jsx/utils/extractSourceCode.js';
import type { JSONObject } from '../types/data/json.js';

export type MetadataLeaf = {
  context?: string;
  maxChars?: number;
  sourceCode?: Record<string, SourceCode[]>;
};

export type MetadataObject = { [key: string]: MetadataLeaf | MetadataObject };
export type MetadataArray = (MetadataLeaf | MetadataObject)[];
export type KeyedMetadata = MetadataObject | MetadataArray;

/**
 * Validates that the metadata key structure is a subset of the source key structure.
 * Uses the source to determine whether a metadata value is a leaf (source value is a string)
 * or a nested object (source value is an object).
 */
function validateMetadataStructure(
  source: JSONObject,
  metadata: MetadataObject,
  currentPath: string[] = []
): string[] {
  const errors: string[] = [];

  for (const key of Object.keys(metadata)) {
    const sourceValue = source[key];
    const keyPath = [...currentPath, key];

    if (sourceValue === undefined) {
      errors.push(
        `Key "${keyPath.join('.')}" does not exist in source`
      );
      continue;
    }

    // If the source value is a string, this is a translatable leaf — metadata should be a MetadataLeaf
    // If the source value is a nested object, recurse
    if (
      typeof sourceValue === 'object' &&
      sourceValue !== null &&
      !Array.isArray(sourceValue)
    ) {
      const metaValue = metadata[key];
      if (Array.isArray(metaValue)) {
        errors.push(
          `Key "${keyPath.join('.')}" is an array but source is an object`
        );
      } else if (typeof metaValue === 'object' && metaValue !== null) {
        errors.push(
          ...validateMetadataStructure(
            sourceValue as JSONObject,
            metaValue as MetadataObject,
            keyPath
          )
        );
      } else {
        errors.push(
          `Key "${keyPath.join('.')}" is a primitive but source is an object`
        );
      }
    }
  }

  return errors;
}

/**
 * Detects and parses a companion metadata file for a given source file.
 *
 * For `translations.json`, looks for `translations.metadata.json`.
 * For `translations.yaml` or `translations.yml`, looks for `translations.metadata.yaml` or `.yml`.
 *
 * @param sourceFilePath - Absolute path to the source file
 * @param sourceContent - Parsed source content (object) for structure validation
 * @returns Parsed metadata object, or undefined if no companion file exists
 */
export function parseKeyedMetadata(
  sourceFilePath: string,
  sourceContent: JSONObject | JSONObject[]
): KeyedMetadata | undefined {
  const ext = path.extname(sourceFilePath);
  const baseName = sourceFilePath.slice(0, -ext.length);

  // Determine companion file path and parser
  let metadataFilePath: string | undefined;
  let parse: ((content: string) => JSONObject) | undefined;

  if (ext === '.json') {
    metadataFilePath = `${baseName}.metadata.json`;
    parse = JSON.parse;
  } else if (ext === '.yaml' || ext === '.yml') {
    const yamlPath = `${baseName}.metadata.yaml`;
    const ymlPath = `${baseName}.metadata.yml`;
    if (fs.existsSync(yamlPath)) {
      metadataFilePath = yamlPath;
    } else if (fs.existsSync(ymlPath)) {
      metadataFilePath = ymlPath;
    }
    parse = YAML.parse;
  }

  if (!metadataFilePath || !parse) {
    return undefined;
  }

  if (!fs.existsSync(metadataFilePath)) {
    return undefined;
  }

  // Read and parse
  let metadataContent: KeyedMetadata;
  try {
    const raw = fs.readFileSync(metadataFilePath, 'utf8');
    const parsed = parse(raw);
    if (typeof parsed !== 'object' || parsed === null) {
      const relativePath = path.relative(process.cwd(), metadataFilePath);
      logger.error(
        `Metadata file ${relativePath}: Expected an object or array`
      );
      return exitSync(1);
    }
    metadataContent = parsed as KeyedMetadata;
  } catch {
    const relativePath = path.relative(process.cwd(), metadataFilePath);
    logger.error(`Metadata file ${relativePath}: File is not parsable`);
    return exitSync(1);
  }

  // Reject if root types don't match (array vs object)
  if (Array.isArray(metadataContent) !== Array.isArray(sourceContent)) {
    const relativePath = path.relative(process.cwd(), metadataFilePath);
    logger.error(
      `Metadata file ${relativePath}: Root type (array vs object) does not match source`
    );
    return exitSync(1);
  }

  // Validate structure against source (only for object-rooted files)
  if (!Array.isArray(metadataContent) && !Array.isArray(sourceContent)) {
    const errors = validateMetadataStructure(sourceContent, metadataContent);
    if (errors.length > 0) {
      const relativePath = path.relative(process.cwd(), metadataFilePath);
      for (const error of errors) {
        logger.error(`Metadata file ${relativePath}: ${error}`);
      }
      return exitSync(1);
    }
  }

  return metadataContent;
}
