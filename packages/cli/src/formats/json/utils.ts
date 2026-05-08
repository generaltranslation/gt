import { getLocaleProperties } from 'generaltranslation';
import { exitSync } from '../../console/logging.js';
import { logger } from '../../console/logger.js';
import { LocaleProperties } from 'generaltranslation/types';
import {
  AdditionalOptions,
  JsonSchema,
  SourceObjectOptions,
} from '../../types/index.js';
import { flattenJson } from './flattenJson.js';
import chalk from 'chalk';
import path from 'node:path';
import micromatch from 'micromatch';
import type { JSONObject, JSONValue } from '../../types/data/json.js';
import { getJSONPathMatches } from './jsonPath.js';
const { isMatch } = micromatch;

type MatchingArrayItem = {
  sourceItem: JSONValue;
  keyParentProperty: string | number;
  keyPointer: string;
  index: number;
};

type SourceObjectPointerMap = Record<
  string,
  { sourceObjectValue: JSONValue; sourceObjectOptions: SourceObjectOptions }
>;

// Find the matching source item in an array
// where the key matches the identifying locale property
// If no matching item is found, exit with an error
export function findMatchingItemArray(
  locale: string,
  sourceObjectOptions: SourceObjectOptions,
  sourceObjectPointer: string,
  sourceObjectValue: JSONValue[]
): Record<string, MatchingArrayItem> {
  const { identifyingLocaleProperty, localeKeyJsonPath } =
    getSourceObjectOptionsArray(
      locale,
      sourceObjectPointer,
      sourceObjectOptions
    );
  // Use the json pointer key to locate the source item
  const matchingItems: Record<string, MatchingArrayItem> = {};
  for (const [index, item] of sourceObjectValue.entries()) {
    // Get the key candidates
    const keyCandidates = getJSONPathMatches(item, localeKeyJsonPath);
    if (!keyCandidates) {
      logger.error(
        `Source item at path: ${sourceObjectPointer} does not have a key value at path: ${localeKeyJsonPath}`
      );
      return exitSync(1);
    } else if (keyCandidates.length === 0) {
      // If no key candidates, skip the item
      continue;
    } else if (keyCandidates.length > 1) {
      // If multiple key candidates, exit with an error
      logger.error(
        `Source item at path: ${sourceObjectPointer} has multiple matching keys with path: ${localeKeyJsonPath}`
      );
      return exitSync(1);
    } else if (identifyingLocaleProperty !== keyCandidates[0].value) {
      // Validate the key is the identifying locale property
      continue;
    }
    const keyParentProperty = keyCandidates[0].parentProperty;
    if (keyParentProperty === null) {
      logger.error(
        `Source item at path: ${sourceObjectPointer} has a root-level key match with path: ${localeKeyJsonPath}`
      );
      return exitSync(1);
    }
    // Map the index to the source item
    matchingItems[`/${index}`] = {
      sourceItem: item,
      keyParentProperty,
      keyPointer: keyCandidates[0].pointer,
      index,
    };
  }
  return matchingItems;
}

export function findMatchingItemObject(
  locale: string,
  sourceObjectPointer: string,
  sourceObjectOptions: SourceObjectOptions,
  sourceObjectValue: JSONObject
): { sourceItem: JSONValue | undefined; keyParentProperty: string } {
  const { identifyingLocaleProperty } = getSourceObjectOptionsObject(
    locale,
    sourceObjectPointer,
    sourceObjectOptions
  );

  // Locate the source item
  if (sourceObjectValue[identifyingLocaleProperty]) {
    return {
      sourceItem: sourceObjectValue[identifyingLocaleProperty],
      keyParentProperty: identifyingLocaleProperty,
    };
  }
  return {
    sourceItem: undefined,
    keyParentProperty: identifyingLocaleProperty,
  };
}

/**
 * Get the identifying locale property for an object
 * @param locale - The locale to get the identifying locale property for
 * @param sourceObjectPointer - The path to the source object
 * @param sourceObjectOptions - The source object options
 * @returns The identifying locale property
 */
export function getIdentifyingLocaleProperty(
  locale: string,
  sourceObjectPointer: string,
  sourceObjectOptions: SourceObjectOptions
): string {
  // Validate localeProperty
  const localeProperty = sourceObjectOptions.localeProperty || 'code';
  const identifyingLocaleProperty =
    getLocaleProperties(locale)[localeProperty as keyof LocaleProperties];
  if (!identifyingLocaleProperty) {
    logger.error(
      `Source object options localeProperty is not a valid locale property at path: ${sourceObjectPointer}`
    );
    return exitSync(1);
  }
  return identifyingLocaleProperty;
}

/**
 * Get the identifying locale property and the json path to the key for an array
 * @param locale - The locale to get the identifying locale property for
 * @param sourceObjectPointer - The path to the source object
 * @param sourceObjectOptions - The source object options
 * @returns The identifying locale property and the json path to the key
 */
export function getSourceObjectOptionsArray(
  locale: string,
  sourceObjectPointer: string,
  sourceObjectOptions: SourceObjectOptions
): { identifyingLocaleProperty: string; localeKeyJsonPath: string } {
  const identifyingLocaleProperty = getIdentifyingLocaleProperty(
    locale,
    sourceObjectPointer,
    sourceObjectOptions
  );
  const localeKeyJsonPath = sourceObjectOptions.key;
  if (!localeKeyJsonPath) {
    logger.error(
      `Source object options key is required for array at path: ${sourceObjectPointer}`
    );
    return exitSync(1);
  }
  return { identifyingLocaleProperty, localeKeyJsonPath };
}

export function getSourceObjectOptionsObject(
  defaultLocale: string,
  sourceObjectPointer: string,
  sourceObjectOptions: SourceObjectOptions
): { identifyingLocaleProperty: string } {
  const identifyingLocaleProperty = getIdentifyingLocaleProperty(
    defaultLocale,
    sourceObjectPointer,
    sourceObjectOptions
  );
  const jsonPathKey = sourceObjectOptions.key;
  if (jsonPathKey) {
    logger.error(
      `Source object options key is not allowed for object at path: ${sourceObjectPointer}`
    );
    return exitSync(1);
  }
  return { identifyingLocaleProperty };
}

/**
 * Generate a mapping of sourceObjectPointer to SourceObjectOptions
 * where the sourceObjectPointer is a jsonpointer to the array or object containing
 * @param jsonSchema - The json schema to generate the mapping from
 * @param originalJson - The original json to generate the mapping from
 * @returns A mapping of sourceObjectPointer to SourceObjectOptions
 */
export function generateSourceObjectPointers(
  jsonSchema: {
    [sourceObjectPath: string]: SourceObjectOptions;
  },
  originalJson: JSONValue
): SourceObjectPointerMap {
  const sourceObjectPointers = Object.entries(jsonSchema).reduce(
    (acc: SourceObjectPointerMap, [sourceObjectPath, sourceObjectOptions]) => {
      const sourceObjects = flattenJson(originalJson, [sourceObjectPath]);
      Object.entries(sourceObjects).forEach(([pointer, value]) => {
        acc[pointer as string] = {
          sourceObjectValue: value,
          sourceObjectOptions,
        };
      });
      return acc;
    },
    {}
  );
  return sourceObjectPointers;
}

/**
 * Validate the json schema for composite or include schemas
 * @param options - Additional options containing jsonSchema config
 * @param filePath - The path to the file (used for matching jsonSchema)
 * @returns The json schema, or null if no schema is found
 * @returns exitSync(1) if the json schema is invalid
 */
export function validateJsonSchema(
  options: AdditionalOptions,
  filePath: string
): JsonSchema | null {
  if (!options.jsonSchema) {
    return null;
  }

  const fileGlobs = Object.keys(options.jsonSchema);
  const matchingGlob = fileGlobs.find((fileGlob) =>
    isMatch(path.relative(process.cwd(), filePath), fileGlob)
  );
  if (!matchingGlob || !options.jsonSchema[matchingGlob]) {
    return null;
  }
  // Validate includes or composite
  const jsonSchema = options.jsonSchema[matchingGlob];
  if (jsonSchema.include && jsonSchema.composite) {
    logger.error(
      'include and composite cannot be used together in the same JSON schema'
    );
    return exitSync(1);
  }

  if (!jsonSchema.include && !jsonSchema.composite) {
    logger.error('No include or composite property found in JSON schema');
    return exitSync(1);
  }

  if (jsonSchema.structuralTransform && !jsonSchema.composite) {
    logger.error(
      'structuralTransform requires composite to be defined in the JSON schema'
    );
    return exitSync(1);
  }
  return jsonSchema;
}

const UNSUPPORTED_MINTLIFY_FIELDS = ['$ref'];

/**
 * Recursively traverse a JSON value and collect all objects whose key
 * matches one of the unsupported field names.
 */
function findMintlifyUnsupportedFields(
  value: JSONValue,
  fieldNames: string[],
  pointer: string = ''
): { pointer: string; field: string; fieldValue: string }[] {
  if (value === null || typeof value !== 'object') return [];
  if (Array.isArray(value)) {
    const results: { pointer: string; field: string; fieldValue: string }[] =
      [];
    for (let i = 0; i < value.length; i++) {
      results.push(
        ...findMintlifyUnsupportedFields(
          value[i],
          fieldNames,
          `${pointer}/${i}`
        )
      );
    }
    return results;
  }
  // Check if this object contains an unsupported field
  const objectValue = value as JSONObject;
  for (const field of fieldNames) {
    if (typeof objectValue[field] === 'string') {
      return [{ pointer, field, fieldValue: objectValue[field] }];
    }
  }
  // Recurse into child properties
  const results: { pointer: string; field: string; fieldValue: string }[] = [];
  for (const key of Object.keys(objectValue)) {
    results.push(
      ...findMintlifyUnsupportedFields(
        objectValue[key],
        fieldNames,
        `${pointer}/${key}`
      )
    );
  }
  return results;
}

/**
 * Detect unsupported fields (e.g. $ref) in Mintlify docs.json files.
 * Logs a warning listing the fields found.
 */
export function detectMintlifyUnsupportedFields(
  json: JSONValue,
  filePath: string
): void {
  const unsupported = findMintlifyUnsupportedFields(
    json,
    UNSUPPORTED_MINTLIFY_FIELDS
  );

  if (unsupported.length > 0) {
    const fileName = path.basename(filePath);
    const lines = unsupported
      .map(
        (u) =>
          chalk.yellow('• ') +
          chalk.white(
            `${u.pointer.replace(/\//g, '.').replace(/^\./, '')}.${u.field}`
          )
      )
      .join('\n');
    logger.warn(
      chalk.yellow(
        `Mintlify config splitting is not yet supported. The following \`$ref\` fields were detected in \`${fileName}\` and will not be resolved:\n`
      ) + lines
    );
  }
}
