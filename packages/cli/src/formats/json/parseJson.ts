import micromatch from 'micromatch';
import path from 'path';
import { AdditionalOptions, SourceObjectOptions } from '../../types/index.js';
const { isMatch } = micromatch;

import { flattenJson, flattenJsonWithStringFilter } from './flattenJson.js';
import { getLocaleProperties } from 'generaltranslation';
import { LocaleProperties } from 'generaltranslation/types';
import { JSONPath } from 'jsonpath-plus';
import { exit, logError } from '../../console/logging.js';

// Parse a JSON file according to a JSON schema
export function parseJson(
  content: string,
  filePath: string,
  options: AdditionalOptions,
  defaultLocale?: string
): string {
  const json = JSON.parse(content);
  if (!options.jsonSchema) {
    return content;
  }

  const fileGlobs = Object.keys(options.jsonSchema);
  // Only use the first one that matches
  const matchingGlob = fileGlobs.find((fileGlob) =>
    isMatch(path.relative(process.cwd(), filePath), fileGlob)
  );
  if (!matchingGlob) {
    return content;
  }

  // Check for JSON schema for this file
  const jsonSchema = options.jsonSchema[matchingGlob];
  if (!jsonSchema || (!jsonSchema.include && !jsonSchema.composite)) {
    return content;
  }

  // Validate includes or composite
  if (jsonSchema.include && jsonSchema.composite) {
    logError(
      'include and composite cannot be used together in the same JSON schema'
    );
    exit(1);
  }

  // Handle include
  if (jsonSchema.include) {
    const flattenedJson = flattenJsonWithStringFilter(json, jsonSchema.include);
    return JSON.stringify(flattenedJson);
  }

  // Handle composite
  if (!defaultLocale) {
    logError('defaultLocale is required for composite JSON schemas');
    exit(1);
  }

  // Construct lvl 1
  const sourceObjectPointers: Record<
    string,
    { sourceObjectValue: any; sourceObjectOptions: SourceObjectOptions }
  > = Object.entries(jsonSchema.composite || {}).reduce(
    (acc: Record<string, any>, [sourceObjectPath, sourceObjectOptions]) => {
      const sourceObjects = flattenJson(json, [sourceObjectPath]);
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
  // Construct lvl 2
  const sourceObjectsToTranslate: Record<string, Record<string, string>> = {};
  for (const [
    sourceObjectPointer,
    { sourceObjectValue, sourceObjectOptions },
  ] of Object.entries(sourceObjectPointers)) {
    // Validate localeProperty
    const localeProperty = sourceObjectOptions.localeProperty || 'code';
    const identifyingLocaleProperty =
      getLocaleProperties(defaultLocale)[
        localeProperty as keyof LocaleProperties
      ];
    if (!identifyingLocaleProperty) {
      logError(
        `Source object options localeProperty is not a valid locale property at path: ${sourceObjectPointer}`
      );
      exit(1);
    }

    // Find the default locale in each source item in each sourceObjectValue
    // Array: use key field
    if (sourceObjectOptions.type === 'array') {
      // Validate type
      if (!Array.isArray(sourceObjectValue)) {
        logError(
          `Source object value is not an array at path: ${sourceObjectPointer}`
        );
        exit(1);
      }

      // Validate key
      const jsonPathKey = sourceObjectOptions.key;
      if (!jsonPathKey) {
        logError(
          `Source object options key is required for array at path: ${sourceObjectPointer}`
        );
        exit(1);
      }

      // Use the json pointer key to locate the source item
      let sourceItem: any = null;
      let keyParentProperty: string | null = null;
      for (const item of sourceObjectValue) {
        // Get the key candidates
        const keyCandidates = JSONPath({
          json: item,
          path: jsonPathKey,
          resultType: 'all',
          flatten: true,
          wrap: true,
        });
        if (!keyCandidates) {
          logError(
            `No source item found at path: ${sourceObjectPointer} with key: ${jsonPathKey}`
          );
          exit(1);
        } else if (keyCandidates.length !== 1) {
          logError(
            `Source object key is not unique at path: ${sourceObjectPointer}`
          );
          exit(1);
        }

        // Validate the key is the identifying locale property
        if (
          !keyCandidates[0] ||
          identifyingLocaleProperty !== keyCandidates[0].value
        ) {
          continue;
        }
        sourceItem = item;
        keyParentProperty = keyCandidates[0].parentProperty;
        break;
      }

      // Validate source item exists
      if (!sourceItem) {
        logError(
          `Source item not found at path: ${sourceObjectPointer}. You must specify a source item that contains a key matching the source locale`
        );
        exit(1);
      }

      // Get the fields to translate from the includes
      let itemsToTranslate: any = [];
      for (const include of sourceObjectOptions.include) {
        try {
          const matchingItems = JSONPath({
            json: sourceItem,
            path: include,
            resultType: 'all',
            flatten: true,
            wrap: true,
          });
          if (matchingItems) {
            itemsToTranslate.push(...matchingItems);
          }
        } catch (error) {}
      }
      itemsToTranslate = Object.fromEntries(
        itemsToTranslate
          .filter(
            (item: { parentProperty: string; value: any }) =>
              item.parentProperty !== keyParentProperty
          )
          .map((item: { pointer: string; value: string }) => [
            item.pointer,
            item.value,
          ])
      );

      // Add the items to translate to the result
      sourceObjectsToTranslate[sourceObjectPointer] = itemsToTranslate;
    } else {
      // Object: use the key in this object with the matching locale property
      // Validate type
      if (typeof sourceObjectValue !== 'object' || sourceObjectValue === null) {
        logError(
          `Source object value is not an object at path: ${sourceObjectPointer}`
        );
        exit(1);
      }

      // Validate no key
      const jsonPathKey = sourceObjectOptions.key;
      if (jsonPathKey) {
        logError(
          `Source object options key is not allowed for object at path: ${sourceObjectPointer}`
        );
        exit(1);
      }

      // Locate the source item
      let sourceItem: any = null;
      for (const [key, value] of Object.entries(sourceObjectValue)) {
        if (identifyingLocaleProperty === key) {
          sourceItem = value;
          break;
        }
      }

      // Validate source item exists
      if (!sourceItem) {
        logError(
          `Source item not found at path: ${sourceObjectPointer}. You must specify a source item where its key matches the source locale`
        );
        exit(1);
      }

      // Get the fields to translate from the includes
      const itemsToTranslate = flattenJsonWithStringFilter(
        sourceItem,
        sourceObjectOptions.include
      );

      // Add the items to translate to the result
      sourceObjectsToTranslate[sourceObjectPointer] = itemsToTranslate;
    }
  }

  return JSON.stringify(sourceObjectsToTranslate);
}
