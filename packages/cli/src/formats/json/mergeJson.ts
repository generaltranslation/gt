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
  const originalJson = JSON.parse(originalContent);

  const jsonSchema = validateJsonSchema(options, filePath);
  if (!jsonSchema) {
    return targets.map((target) =>
      JSON.stringify(target.translatedContent, null, 2)
    );
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
        } catch (error) {}
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

      const matchingDefaultLocaleItem = findMatchingItemArray(
        defaultLocale,
        sourceObjectOptions,
        sourceObjectPointer,
        sourceObjectValue
      );
      if (!matchingDefaultLocaleItem) {
        logError(
          `Matching sourceItem not found at path: ${sourceObjectPointer} for locale: ${defaultLocale}. Please check your JSON schema`
        );
        exit(1);
      }
      const {
        sourceItem: defaultLocaleSourceItem,
        keyPointer: defaultLocaleKeyPointer,
      } = matchingDefaultLocaleItem;

      // For each target:
      // 1. Validate that the targetJson has a jsonPointer for the current sourceObjectPointer
      // 2. If it does, find the source item for the target locale
      // 3. Override the source item with the translated values
      // 4. Apply additional mutations to the sourceItem
      // 5. Merge the source item with the original JSON
      for (const target of targets) {
        const targetJson = JSON.parse(target.translatedContent);
        // 1. Validate that the targetJson has a jsonPointer for the current sourceObjectPointer
        if (!targetJson[sourceObjectPointer]) {
          logWarning(
            `Translated JSON for locale: ${target.targetLocale} does not have a valid sourceObjectPointer: ${sourceObjectPointer}. Skipping this target`
          );
          continue;
        }
        // 2. Find the source item for the target locale
        const matchingTargetItem = findMatchingItemArray(
          target.targetLocale,
          sourceObjectOptions,
          sourceObjectPointer,
          sourceObjectValue
        );
        // If the target locale has a matching source item, use it to mutate the source item
        // Otherwise, fallback to the default locale source item
        const mutateSourceItem = structuredClone(defaultLocaleSourceItem);
        const mutateSourceItemIndex = matchingTargetItem
          ? matchingTargetItem.itemIndex
          : undefined;
        const mutateSourceItemKeyPointer = defaultLocaleKeyPointer;
        const { identifyingLocaleProperty: targetLocaleKeyProperty } =
          getSourceObjectOptionsArray(
            target.targetLocale,
            sourceObjectPointer,
            sourceObjectOptions
          );

        // 3. Override the source item with the translated values
        JSONPointer.set(
          mutateSourceItem,
          mutateSourceItemKeyPointer,
          targetLocaleKeyProperty
        );
        for (const [
          translatedKeyJsonPointer,
          translatedValue,
        ] of Object.entries(targetJson[sourceObjectPointer] || {})) {
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
          } catch (error) {}
        }
        // 4. Apply additional mutations to the sourceItem
        // TODO: Implement this

        // 5. Merge the source item with the original JSON
        if (mutateSourceItemIndex) {
          sourceObjectValue[mutateSourceItemIndex] = mutateSourceItem;
        } else {
          sourceObjectValue.push(mutateSourceItem);
        }
      }
      JSONPointer.set(mergedJson, sourceObjectPointer, sourceObjectValue);
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
      // 1. Validate that the targetJson has a jsonPointer for the current sourceObjectPointer
      // 2. If it does, find the source item for the target locale
      // 3. Override the source item with the translated values
      // 4. Apply additional mutations to the sourceItem
      // 5. Merge the source item with the original JSON
      for (const target of targets) {
        const targetJson = JSON.parse(target.translatedContent);
        // 1. Validate that the targetJson has a jsonPointer for the current sourceObjectPointer
        if (!targetJson[sourceObjectPointer]) {
          logWarning(
            `Translated JSON for locale: ${target.targetLocale} does not have a valid sourceObjectPointer: ${sourceObjectPointer}. Skipping this target`
          );
          continue;
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

        // 3. Override the source item with the translated values
        for (const [
          translatedKeyJsonPointer,
          translatedValue,
        ] of Object.entries(targetJson[sourceObjectPointer] || {})) {
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
          } catch (error) {}
        }
        // 4. Apply additional mutations to the sourceItem
        // TODO: Implement this

        // 5. Merge the source item with the original JSON
        sourceObjectValue[mutateSourceItemKey] = mutateSourceItem;
      }
      JSONPointer.set(mergedJson, sourceObjectPointer, sourceObjectValue);
    }
  }
  return [JSON.stringify(mergedJson, null, 2)];
}
