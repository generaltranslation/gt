import { getLocaleProperties } from 'generaltranslation';
import { exit, logError } from '../../console/logging.js';
import { JSONPath } from 'jsonpath-plus';
import { LocaleProperties } from 'generaltranslation/types';
import {
  AdditionalOptions,
  JsonSchema,
  SourceObjectOptions,
} from '../../types/index.js';
import { flattenJson } from './flattenJson.js';
import micromatch from 'micromatch';
import path from 'node:path';
const { isMatch } = micromatch;

// Find the matching source item in an array
// where the key matches the identifying locale property
// If no matching item is found, exit with an error
export function findMatchingItemArray(
  locale: string,
  sourceObjectOptions: SourceObjectOptions,
  sourceObjectPointer: string,
  sourceObjectValue: any
): {
  sourceItem: any;
  keyParentProperty: string;
  itemIndex: number;
  keyPointer: string;
} | null {
  const { identifyingLocaleProperty, localeKeyJsonPath } =
    getSourceObjectOptionsArray(
      locale,
      sourceObjectPointer,
      sourceObjectOptions
    );
  // Use the json pointer key to locate the source item
  for (const [index, item] of sourceObjectValue.entries()) {
    // Get the key candidates
    const keyCandidates = JSONPath({
      json: item,
      path: localeKeyJsonPath,
      resultType: 'all',
      flatten: true,
      wrap: true,
    });
    if (!keyCandidates) {
      logError(
        `Source item at path: ${sourceObjectPointer} does not have a key value at path: ${localeKeyJsonPath}`
      );
      exit(1);
    } else if (keyCandidates.length !== 1) {
      logError(
        `Source item at path: ${sourceObjectPointer} has multiple matching keys with path: ${localeKeyJsonPath}`
      );
      exit(1);
    }

    // Validate the key is the identifying locale property
    if (
      !keyCandidates.length ||
      identifyingLocaleProperty !== keyCandidates[0].value
    ) {
      continue;
    }
    return {
      sourceItem: item,
      keyParentProperty: keyCandidates[0].parentProperty,
      itemIndex: index,
      keyPointer: keyCandidates[0].pointer,
    };
  }
  return null;
}

export function findMatchingItemObject(
  locale: string,
  sourceObjectPointer: string,
  sourceObjectOptions: SourceObjectOptions,
  sourceObjectValue: any
): { sourceItem: any | undefined; keyParentProperty: string } {
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
    logError(
      `Source object options localeProperty is not a valid locale property at path: ${sourceObjectPointer}`
    );
    exit(1);
  }
  return identifyingLocaleProperty;
}

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
    logError(
      `Source object options key is required for array at path: ${sourceObjectPointer}`
    );
    exit(1);
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
    logError(
      `Source object options key is not allowed for object at path: ${sourceObjectPointer}`
    );
    exit(1);
  }
  return { identifyingLocaleProperty };
}

// Generate a mapping of sourceObjectPointer to SourceObjectOptions
// where the sourceObjectPointer is a jsonpointer to the array or object containing
export function generateSourceObjectPointers(
  jsonSchema: {
    [sourceObjectPath: string]: SourceObjectOptions;
  },
  originalJson: any
): Record<
  string,
  { sourceObjectValue: any; sourceObjectOptions: SourceObjectOptions }
> {
  const sourceObjectPointers: Record<
    string,
    { sourceObjectValue: any; sourceObjectOptions: SourceObjectOptions }
  > = Object.entries(jsonSchema).reduce(
    (acc: Record<string, any>, [sourceObjectPath, sourceObjectOptions]) => {
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
    logError(
      'include and composite cannot be used together in the same JSON schema'
    );
    exit(1);
    return null;
  }

  if (!jsonSchema.include && !jsonSchema.composite) {
    logError('No include or composite property found in JSON schema');
    exit(1);
    return null;
  }
  return jsonSchema;
}
