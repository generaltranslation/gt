import { AdditionalOptions, SourceObjectOptions } from '../../types/index.js';
import { logger } from '../../console/logger.js';
import {
  findMatchingItemArray,
  findMatchingItemObject,
  generateSourceObjectPointers,
  validateJsonSchema,
} from './utils.js';
import { flattenJsonWithStringFilter } from './flattenJson.js';
import { gt } from '../../utils/gt.js';

/**
 * Extracts translated values from a full JSON file back into composite JSON format.
 * This is the inverse of mergeJson - it takes a merged/reconstructed JSON file
 * and extracts the values for a specific locale into the composite structure
 * that the server expects.
 *
 * @param localContent - The full JSON content from the user's local file
 * @param inputPath - The path to the file (used for matching jsonSchema)
 * @param options - Additional options containing jsonSchema config
 * @param targetLocale - The locale to extract values for
 * @param defaultLocale - The default/source locale
 * @returns The composite JSON string, or null if no extraction needed
 */
export function extractJson(
  localContent: string,
  inputPath: string,
  options: AdditionalOptions,
  targetLocale: string,
  defaultLocale: string
): string | null {
  const jsonSchema = validateJsonSchema(options, inputPath);
  if (!jsonSchema) {
    // No schema - return content as-is
    return null;
  }

  let localJson: any;
  try {
    localJson = JSON.parse(localContent);
  } catch {
    logger.error(`Invalid JSON file: ${inputPath}`);
    return null;
  }

  const useCanonicalLocaleKeys =
    options?.experimentalCanonicalLocaleKeys ?? false;
  const canonicalTargetLocale = useCanonicalLocaleKeys
    ? gt.resolveCanonicalLocale(targetLocale)
    : targetLocale;

  // Handle include-style schemas (simple path-based extraction)
  if (jsonSchema.include) {
    const extracted = flattenJsonWithStringFilter(localJson, jsonSchema.include);
    return JSON.stringify(extracted, null, 2);
  }

  if (!jsonSchema.composite) {
    logger.error('No include or composite property found in JSON schema');
    return null;
  }

  // Handle composite schemas
  const compositeResult: Record<string, any> = {};

  // Generate source object pointers from the local JSON
  const sourceObjectPointers = generateSourceObjectPointers(
    jsonSchema.composite,
    localJson
  );

  for (const [
    sourceObjectPointer,
    { sourceObjectValue, sourceObjectOptions },
  ] of Object.entries(sourceObjectPointers)) {
    if (sourceObjectOptions.type === 'array') {
      if (!Array.isArray(sourceObjectValue)) {
        logger.warn(
          `Source object value is not an array at path: ${sourceObjectPointer}`
        );
        continue;
      }

      // Find the matching items for the target locale
      const matchingTargetLocaleItems = findMatchingItemArray(
        canonicalTargetLocale,
        sourceObjectOptions,
        sourceObjectPointer,
        sourceObjectValue
      );

      if (!Object.keys(matchingTargetLocaleItems).length) {
        logger.warn(
          `No matching items found for locale ${targetLocale} at path: ${sourceObjectPointer}`
        );
        continue;
      }

      // Initialize the nested structure for this source object pointer
      if (!compositeResult[sourceObjectPointer]) {
        compositeResult[sourceObjectPointer] = {};
      }

      // For each matching item, extract the included values
      for (const [itemPointer, { sourceItem }] of Object.entries(
        matchingTargetLocaleItems
      )) {
        // Extract values at the include paths
        const extractedValues = flattenJsonWithStringFilter(
          sourceItem,
          sourceObjectOptions.include
        );

        // Store under the item pointer (e.g., "/0")
        compositeResult[sourceObjectPointer][itemPointer] = extractedValues;
      }
    } else {
      // Object type
      if (typeof sourceObjectValue !== 'object' || sourceObjectValue === null) {
        logger.warn(
          `Source object value is not an object at path: ${sourceObjectPointer}`
        );
        continue;
      }

      // Find the matching item for the target locale
      const matchingTargetItem = findMatchingItemObject(
        canonicalTargetLocale,
        sourceObjectPointer,
        sourceObjectOptions,
        sourceObjectValue
      );

      if (!matchingTargetItem.sourceItem) {
        logger.warn(
          `No matching item found for locale ${targetLocale} at path: ${sourceObjectPointer}`
        );
        continue;
      }

      // Extract values at the include paths
      const extractedValues = flattenJsonWithStringFilter(
        matchingTargetItem.sourceItem,
        sourceObjectOptions.include
      );

      // Store the extracted values
      compositeResult[sourceObjectPointer] = extractedValues;
    }
  }

  return JSON.stringify(compositeResult, null, 2);
}
