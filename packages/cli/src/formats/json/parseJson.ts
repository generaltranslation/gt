import micromatch from 'micromatch';
import path from 'path';
import { AdditionalOptions } from '../../types/index.js';
import { flattenJsonDictionary } from '../../react/utils/flattenDictionary.js';
const { isMatch } = micromatch;

import { JSONPath } from 'jsonpath-plus';
import { flattenJson, flattenJsonWithStringFilter } from './flattenJson.js';
import { getLocaleProperties } from 'generaltranslation';
import { LocaleProperties } from 'generaltranslation/types';

type SourceObjectOptions = {
  type: 'array' | 'object';
  include: string[];
  key?: string;
  localeProperty: string;
  mutate?: {
    [sourceItemPath: string]: {
      match?: string;
      replace?: string;
    };
  };
};
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
    throw new Error(
      'include and composite cannot be used together in the same JSON schema'
    );
  }

  // Handle include
  if (jsonSchema.include) {
    const flattenedJson = flattenJsonWithStringFilter(json, jsonSchema.include);
    return JSON.stringify(flattenedJson);
  }

  // Handle composite
  if (!defaultLocale) {
    throw new Error('defaultLocale is required for composite JSON schemas');
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
      throw new Error(
        `Source object options localeProperty is not a valid locale property at path: ${sourceObjectPointer}`
      );
    }

    // Find the default locale in each source item in each sourceObjectValue
    // Array: use key field
    if (sourceObjectOptions.type === 'array') {
      // Validate type
      if (!Array.isArray(sourceObjectValue)) {
        throw new Error(
          `Source object value is not an array at path: ${sourceObjectPointer}`
        );
      }

      // Validate key
      const jsonPathKey = sourceObjectOptions.key;
      if (!jsonPathKey) {
        throw new Error(
          `Source object options key is required for array at path: ${sourceObjectPointer}`
        );
      }

      // Use the json pointer key to locate the source item
      let sourceItem: any = null;
      let sourceItemKeyPointer: string | null = null;
      for (const item of sourceObjectValue) {
        // Get the key candidates
        const keyCandidates = Object.entries(
          flattenJsonWithStringFilter(item, [jsonPathKey])
        );
        if (keyCandidates.length !== 1) {
          throw new Error(
            `Source object key is not unique at path: ${sourceObjectPointer}`
          );
        }

        // Validate the key is the identifying locale property
        if (
          !keyCandidates[0] ||
          identifyingLocaleProperty !== keyCandidates[0][1].value
        ) {
          continue;
        }
        sourceItem = item;
        // TODO: Check if the includes path contains the pointer, and throw an error if it does!
        sourceItemKeyPointer = keyCandidates[0][0];
        break;
      }

      // Validate source item exists
      if (!sourceItem) {
        throw new Error(
          `Source item not found at path: ${sourceObjectPointer}. You must specify a source item that contains a key matching the source locale`
        );
      }

      // Get the fields to translate from the includes
      const itemsToTranslate = flattenJsonWithStringFilter(
        sourceItem,
        sourceObjectOptions.include
      );

      // Add the items to translate to the result
      sourceObjectsToTranslate[sourceObjectPointer] = itemsToTranslate;
    } else {
      // Object: use the key in this object with the matching locale property
      // Validate type
      if (typeof sourceObjectValue !== 'object' || sourceObjectValue === null) {
        throw new Error(
          `Source object value is not an object at path: ${sourceObjectPointer}`
        );
      }

      // Validate no key
      const jsonPathKey = sourceObjectOptions.key;
      if (jsonPathKey) {
        throw new Error(
          `Source object options key is not allowed for object at path: ${sourceObjectPointer}`
        );
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
        throw new Error(
          `Source item not found at path: ${sourceObjectPointer}. You must specify a source item where its key matches the source locale`
        );
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
