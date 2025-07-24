import { AdditionalOptions, SourceObjectOptions } from '../../types/index.js';
import { flattenJsonWithStringFilter } from './flattenJson.js';
import { JSONPath } from 'jsonpath-plus';
import { exit, logError } from '../../console/logging.js';
import {
  findMatchingItemArray,
  findMatchingItemObject,
  generateSourceObjectPointers,
  validateJsonSchema,
} from './utils.js';

// Parse a JSON file according to a JSON schema
export function parseJson(
  content: string,
  filePath: string,
  options: AdditionalOptions,
  defaultLocale: string
): string {
  const jsonSchema = validateJsonSchema(options, filePath);
  if (!jsonSchema) {
    return content;
  }
  let json: any;
  try {
    json = JSON.parse(content);
  } catch (error) {
    logError(`Invalid JSON file: ${filePath}`);
    exit(1);
  }

  // Handle include
  if (jsonSchema.include) {
    const flattenedJson = flattenJsonWithStringFilter(json, jsonSchema.include);
    return JSON.stringify(flattenedJson);
  }

  if (!jsonSchema.composite) {
    logError('No composite property found in JSON schema');
    exit(1);
  }

  // Construct lvl 1
  // Create mapping of sourceObjectPointer to SourceObjectOptions
  const sourceObjectPointers: Record<
    string,
    { sourceObjectValue: any; sourceObjectOptions: SourceObjectOptions }
  > = generateSourceObjectPointers(jsonSchema.composite, json);

  // Construct lvl 2
  const sourceObjectsToTranslate: Record<string, Record<string, string>> = {};
  for (const [
    sourceObjectPointer,
    { sourceObjectValue, sourceObjectOptions },
  ] of Object.entries(sourceObjectPointers)) {
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
      // Validate localeProperty
      const matchingItem = findMatchingItemArray(
        defaultLocale,
        sourceObjectOptions,
        sourceObjectPointer,
        sourceObjectValue
      );
      if (!matchingItem) {
        logError(
          `Matching sourceItem not found at path: ${sourceObjectPointer} for locale: ${defaultLocale}. Please check your JSON schema`
        );
        exit(1);
      }
      const { sourceItem, keyPointer } = matchingItem;
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
            (item: { pointer: string; value: any }) =>
              item.pointer !== keyPointer
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

      // Validate localeProperty
      const matchingItem = findMatchingItemObject(
        defaultLocale,
        sourceObjectPointer,
        sourceObjectOptions,
        sourceObjectValue
      );
      // Validate source item exists
      if (!matchingItem.sourceItem) {
        logError(
          `Source item not found at path: ${sourceObjectPointer}. You must specify a source item where its key matches the default locale`
        );
        exit(1);
      }
      const { sourceItem } = matchingItem;

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
