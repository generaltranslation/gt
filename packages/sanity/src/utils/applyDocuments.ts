import { JSONPath } from 'jsonpath-plus';
import JSONPointer from 'jsonpointer';
import type { IgnoreFields, SkipFields } from '../adapter/types';

export function applyDocuments(
  documentId: string,
  sourceDocument: Record<string, any>,
  targetDocument: Record<string, any>,
  ignore: IgnoreFields[],
  skip: SkipFields[] = []
) {
  const ignoreFields = ignore.filter(
    (field) =>
      field.documentId === documentId ||
      field.documentId === undefined ||
      field.documentId === null
  );

  // Start with a shallow copy of the source document
  const mergedDocument = { ...sourceDocument };

  // Merge top-level properties of targetDocument
  for (const [key, value] of Object.entries(targetDocument)) {
    mergedDocument[key] = value;
  }

  // Process ignored fields and restore them from source document
  for (const ignoreField of ignoreFields) {
    if (!ignoreField.fields) continue;

    for (const field of ignoreField.fields) {
      const { property, type } = field;

      try {
        // Use JSONPath to find matching paths, then JSONPointer to get/set values
        const sourceResults = JSONPath({
          json: sourceDocument,
          path: property,
          resultType: 'all',
          flatten: true,
          wrap: true,
        });

        if (sourceResults && sourceResults.length > 0) {
          // Process each matching path
          sourceResults.forEach((result: { pointer: string; value: any }) => {
            const sourceValue = result.value;

            // If type is specified, check if it matches the object's _type property
            if (type !== undefined) {
              if (
                typeof sourceValue === 'object' &&
                sourceValue !== null &&
                sourceValue._type === type
              ) {
                // Type matches, restore the entire object using JSONPointer
                JSONPointer.set(mergedDocument, result.pointer, sourceValue);
              }
            } else {
              // No type specified, restore the value using JSONPointer
              JSONPointer.set(mergedDocument, result.pointer, sourceValue);
            }
          });
        }
      } catch (error) {
        // Invalid JSONPath, skip this field
        console.warn(`Invalid JSONPath: ${property}`, error);
      }
    }
  }

  // Process skip fields and remove them from the merged document
  const skipFields = skip.filter(
    (field) =>
      field.documentId === documentId ||
      field.documentId === undefined ||
      field.documentId === null
  );

  for (const skipField of skipFields) {
    if (!skipField.fields) continue;

    for (const field of skipField.fields) {
      const { property, type } = field;

      try {
        const results = JSONPath({
          json: mergedDocument,
          path: property,
          resultType: 'all',
          flatten: true,
          wrap: true,
        });

        if (results && results.length > 0) {
          results.forEach(
            (result: {
              pointer: string;
              value: any;
              parent: any;
              parentProperty: string;
            }) => {
              if (type !== undefined) {
                if (
                  typeof result.value === 'object' &&
                  result.value !== null &&
                  result.value._type === type
                ) {
                  delete result.parent[result.parentProperty];
                }
              } else {
                delete result.parent[result.parentProperty];
              }
            }
          );
        }
      } catch (error) {
        console.warn(`Invalid JSONPath: ${property}`, error);
      }
    }
  }

  return mergedDocument;
}
