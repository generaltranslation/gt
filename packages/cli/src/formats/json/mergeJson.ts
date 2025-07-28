import JSONPointer from 'jsonpointer';
import { AdditionalOptions, SourceObjectOptions } from '../../types/index.js';
import { exit, logError, logWarning } from '../../console/logging.js';
import {
  findMatchingItemArray,
  findMatchingItemObject,
  generateSourceObjectPointers,
  getSourceObjectOptionsArray,
  validateJsonSchema,
} from './utils.js';
import { JSONPath } from 'jsonpath-plus';
import { getLocaleProperties } from 'generaltranslation';
import { LocaleProperties } from 'generaltranslation/types';

export function mergeJson(
  originalContent: string,
  filePath: string,
  options: AdditionalOptions,
  targets: {
    translatedContent: string;
    targetLocale: string;
  }[],
  defaultLocale: string
): string[] {
  const jsonSchema = validateJsonSchema(options, filePath);
  if (!jsonSchema) {
    return targets.map((target) => target.translatedContent);
  }

  let originalJson: any;
  try {
    originalJson = JSON.parse(originalContent);
  } catch {
    logError(`Invalid JSON file: ${filePath}`);
    exit(1);
  }

  // Handle include
  if (jsonSchema.include) {
    const output: string[] = [];
    for (const target of targets) {
      // Must clone the original JSON to avoid mutations
      const mergedJson = structuredClone(originalJson);
      const translatedJson = JSON.parse(target.translatedContent);
      for (const [jsonPointer, translatedValue] of Object.entries(
        translatedJson
      )) {
        try {
          const value = JSONPointer.get(mergedJson, jsonPointer);
          if (!value) continue;
          JSONPointer.set(mergedJson, jsonPointer, translatedValue);
        } catch {
          /* empty */
        }
      }
      output.push(JSON.stringify(mergedJson, null, 2));
    }
    return output;
  }

  if (!jsonSchema.composite) {
    logError('No composite property found in JSON schema');
    exit(1);
  }

  // Handle composite
  // Create a deep copy of the original JSON to avoid mutations
  const mergedJson = structuredClone(originalJson);

  // Create mapping of sourceObjectPointer to SourceObjectOptions
  const sourceObjectPointers: Record<
    string,
    { sourceObjectValue: any; sourceObjectOptions: SourceObjectOptions }
  > = generateSourceObjectPointers(jsonSchema.composite, originalJson);

  // Find the source object
  for (const [
    sourceObjectPointer,
    { sourceObjectValue, sourceObjectOptions },
  ] of Object.entries(sourceObjectPointers)) {
    // Find the source item
    if (sourceObjectOptions.type === 'array') {
      // Validate type
      if (!Array.isArray(sourceObjectValue)) {
        logError(
          `Source object value is not an array at path: ${sourceObjectPointer}`
        );
        exit(1);
      }

      // Get source item for default locale
      const matchingDefaultLocaleItems = findMatchingItemArray(
        defaultLocale,
        sourceObjectOptions,
        sourceObjectPointer,
        sourceObjectValue
      );
      if (!Object.keys(matchingDefaultLocaleItems).length) {
        logWarning(
          `Matching sourceItems not found at path: ${sourceObjectPointer}. Please check your JSON file includes the key field. Skipping this target`
        );
        continue;
      }

      const matchingDefaultLocaleItemKeys = new Set(
        Object.keys(matchingDefaultLocaleItems)
      );

      // For each target:
      // 1. Get the target items
      // 2. Track all array indecies to remove (will be overwritten)
      // 3. Merge matchingDefaultLocaleItems and targetItems
      // 4. Validate that the mergedItems is not empty
      // For each target item:
      //   5. Validate that all the array indecies are still present in the source json
      //   6. Override the source item with the translated values
      //   7. Apply additional mutations to the sourceItem
      //   8. Track all items to add
      // 9. Check that items to add is >= items to remove
      // 10. Remove all items for the target locale (they can be identified by the key)
      const indiciesToRemove = new Set<number>();
      const itemsToAdd: any[] = [];
      for (const target of targets) {
        const targetJson = JSON.parse(target.translatedContent);
        let targetItems = targetJson[sourceObjectPointer];
        // 1. Get the target items
        if (!targetItems) {
          // If no translation can be found, a transformation may need to happen still
          targetItems = {};
        }

        // 2. Track all array indecies to remove (will be overwritten)
        const targetItemsToRemove = findMatchingItemArray(
          target.targetLocale,
          sourceObjectOptions,
          sourceObjectPointer,
          sourceObjectValue
        );
        Object.values(targetItemsToRemove).forEach(({ index }) =>
          indiciesToRemove.add(index)
        );

        // 3. Merge matchingDefaultLocaleItems and targetItems
        const mergedItems = {
          ...(sourceObjectOptions.transform ? matchingDefaultLocaleItems : {}),
          ...targetItems,
        };
        // 4. Validate that the mergedItems is not empty
        if (Object.keys(mergedItems).length === 0) {
          logWarning(
            `Translated JSON for locale: ${target.targetLocale} does not have a valid sourceObjectPointer: ${sourceObjectPointer}. Skipping this target`
          );
          continue;
        }

        for (const [sourceItemPointer, targetItem] of Object.entries(
          mergedItems
        )) {
          // 5. Validate that all the array indecies are still present in the source json
          if (!matchingDefaultLocaleItemKeys.has(sourceItemPointer)) {
            logError(
              `Array index ${sourceItemPointer} is not present in the source json. It is possible that the source json has been modified since the translation was generated.`
            );
            exit(1);
          }

          // 6. Override the source item with the translated values
          const defaultLocaleSourceItem =
            matchingDefaultLocaleItems[sourceItemPointer].sourceItem;
          const defaultLocaleKeyPointer =
            matchingDefaultLocaleItems[sourceItemPointer].keyPointer;
          const mutatedSourceItem = structuredClone(defaultLocaleSourceItem);
          const { identifyingLocaleProperty: targetLocaleKeyProperty } =
            getSourceObjectOptionsArray(
              target.targetLocale,
              sourceObjectPointer,
              sourceObjectOptions
            );
          JSONPointer.set(
            mutatedSourceItem,
            defaultLocaleKeyPointer,
            targetLocaleKeyProperty
          );
          for (const [
            translatedKeyJsonPointer,
            translatedValue,
          ] of Object.entries(targetItem || {})) {
            try {
              const value = JSONPointer.get(
                mutatedSourceItem,
                translatedKeyJsonPointer
              );
              if (!value) continue;
              JSONPointer.set(
                mutatedSourceItem,
                translatedKeyJsonPointer,
                translatedValue
              );
            } catch {
              /* empty */
            }
          }

          // 7. Apply additional mutations to the sourceItem
          applyTransformations(
            mutatedSourceItem,
            sourceObjectOptions.transform,
            target.targetLocale,
            defaultLocale
          );

          itemsToAdd.push(mutatedSourceItem);
        }
      }

      // 8. Check that items to add is >= items to remove (if this happens, something is very wrong)
      if (itemsToAdd.length < indiciesToRemove.size) {
        logError(
          `Items to add is less than items to remove at path: ${sourceObjectPointer}. Please check your JSON schema key field.`
        );
        exit(1);
      }

      // 9. Remove all items for the target locale (they can be identified by the key)
      const filteredSourceObjectValue = sourceObjectValue.filter(
        (_, index: number) => !indiciesToRemove.has(index)
      );

      // 10. Add all items to the original JSON
      filteredSourceObjectValue.push(...itemsToAdd);

      JSONPointer.set(
        mergedJson,
        sourceObjectPointer,
        filteredSourceObjectValue
      );
    } else {
      // Validate type
      if (typeof sourceObjectValue !== 'object' || sourceObjectValue === null) {
        logError(
          `Source object value is not an object at path: ${sourceObjectPointer}`
        );
        exit(1);
      }
      // Validate localeProperty
      const matchingDefaultLocaleItem = findMatchingItemObject(
        defaultLocale,
        sourceObjectPointer,
        sourceObjectOptions,
        sourceObjectValue
      );
      // Validate source item exists
      if (!matchingDefaultLocaleItem.sourceItem) {
        logError(
          `Source item not found at path: ${sourceObjectPointer}. You must specify a source item where its key matches the default locale`
        );
        exit(1);
      }
      const { sourceItem: defaultLocaleSourceItem } = matchingDefaultLocaleItem;

      // For each target:
      // 1. Get the target items
      // 2. Find the source item for the target locale
      // 3. Merge the target items with the source item
      // 4. Validate that the mergedItems is not empty
      // 5. Override the source item with the translated values
      // 6. Apply additional mutations to the sourceItem
      // 7. Merge the source item with the original JSON (if the source item is not a new item)
      for (const target of targets) {
        const targetJson = JSON.parse(target.translatedContent);
        // 1. Get the target items
        let targetItems = targetJson[sourceObjectPointer];
        if (!targetItems) {
          targetItems = {};
        }

        // 2. Find the source item for the target locale
        const matchingTargetItem = findMatchingItemObject(
          target.targetLocale,
          sourceObjectPointer,
          sourceObjectOptions,
          sourceObjectValue
        );
        // If the target locale has a matching source item, use it to mutate the source item
        // Otherwise, fallback to the default locale source item
        const mutateSourceItem = structuredClone(defaultLocaleSourceItem);
        const mutateSourceItemKey = matchingTargetItem.keyParentProperty;

        // 3. Merge the target items with the source item (if there are transformations to perform)
        const mergedItems = {
          ...(sourceObjectOptions.transform ? defaultLocaleSourceItem : {}),
          ...targetItems,
        };

        // 4. Validate that the mergedItems is not empty
        if (Object.keys(mergedItems).length === 0) {
          logWarning(
            `Translated JSON for locale: ${target.targetLocale} does not have a valid sourceObjectPointer: ${sourceObjectPointer}. Skipping this target`
          );
          continue;
        }

        // 5. Override the source item with the translated values
        for (const [
          translatedKeyJsonPointer,
          translatedValue,
        ] of Object.entries(mergedItems || {})) {
          try {
            const value = JSONPointer.get(
              mutateSourceItem,
              translatedKeyJsonPointer
            );
            if (!value) continue;
            JSONPointer.set(
              mutateSourceItem,
              translatedKeyJsonPointer,
              translatedValue
            );
          } catch {
            /* empty */
          }
        }
        // 6. Apply additional mutations to the sourceItem
        applyTransformations(
          mutateSourceItem,
          sourceObjectOptions.transform,
          target.targetLocale,
          defaultLocale
        );

        // 7. Merge the source item with the original JSON
        sourceObjectValue[mutateSourceItemKey] = mutateSourceItem;
      }
      JSONPointer.set(mergedJson, sourceObjectPointer, sourceObjectValue);
    }
  }
  return [JSON.stringify(mergedJson, null, 2)];
}

// helper function to replace locale placeholders in a string
// with the corresponding locale properties
// ex: {locale} -> will be replaced with the locale code
// ex: {localeName} -> will be replaced with the locale name
function replaceLocalePlaceholders(
  string: string,
  localeProperties: LocaleProperties
): string {
  return string.replace(/\{(\w+)\}/g, (match, property) => {
    // Handle common aliases
    if (property === 'locale' || property === 'localeCode') {
      return localeProperties.code;
    }
    if (property === 'localeName') {
      return localeProperties.name;
    }
    if (property === 'localeNativeName') {
      return localeProperties.nativeName;
    }
    // Check if the property exists in localeProperties
    if (property in localeProperties) {
      return localeProperties[property as keyof typeof localeProperties];
    }
    // Return the original placeholder if property not found
    return match;
  });
}

/**
 * Apply transformations to the sourceItem in-place
 * @param sourceItem - The source item to apply transformations to
 * @param transform - The transformations to apply
 * @param targetLocale - The target locale
 * @param defaultLocale - The default locale
 */
export function applyTransformations(
  sourceItem: any,
  transform: SourceObjectOptions['transform'],
  targetLocale: string,
  defaultLocale: string
): void {
  if (!transform) return;

  const targetLocaleProperties = getLocaleProperties(targetLocale);
  const defaultLocaleProperties = getLocaleProperties(defaultLocale);

  for (const [transformPath, transformOptions] of Object.entries(transform)) {
    if (
      !transformOptions.replace ||
      typeof transformOptions.replace !== 'string'
    ) {
      continue;
    }
    const results = JSONPath({
      json: sourceItem,
      path: transformPath,
      resultType: 'all',
      flatten: true,
      wrap: true,
    });
    if (!results || results.length === 0) {
      continue;
    }
    results.forEach((result: { pointer: string; value: any }) => {
      if (typeof result.value !== 'string') {
        return;
      }
      // Replace locale placeholders in the replace string
      let replaceString = transformOptions.replace;

      // Replace all locale property placeholders
      replaceString = replaceLocalePlaceholders(
        replaceString,
        targetLocaleProperties
      );

      if (
        transformOptions.match &&
        typeof transformOptions.match === 'string'
      ) {
        // Replace locale placeholders in the match string using defaultLocale properties
        let matchString = transformOptions.match;
        matchString = replaceLocalePlaceholders(
          matchString,
          defaultLocaleProperties
        );

        result.value = result.value.replace(
          new RegExp(matchString, 'g'),
          replaceString
        );
      } else {
        result.value = replaceString;
      }

      // Update the actual sourceItem using JSONPointer
      JSONPointer.set(sourceItem, result.pointer, result.value);
    });
  }
}
