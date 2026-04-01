import { JSONPath } from 'jsonpath-plus';
import JSONPointer from 'jsonpointer';
import type { IgnoreFields, SkipFields } from '../adapter/types';

export function forEachMatchingField(
  documentId: string,
  document: Record<string, any>,
  fields: IgnoreFields[],
  callback: (result: {
    pointer: string;
    value: any;
    parent: any;
    parentProperty: string;
  }) => void
): void {
  const applicable = fields.filter(
    (field) =>
      field.documentId === documentId ||
      field.documentId === undefined ||
      field.documentId === null
  );

  for (const entry of applicable) {
    if (!entry.fields) continue;

    for (const field of entry.fields) {
      const { property, type } = field;

      try {
        const results = JSONPath({
          json: document,
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
                  callback(result);
                }
              } else {
                callback(result);
              }
            }
          );
        }
      } catch (error) {
        console.warn(`Invalid JSONPath: ${property}`, error);
      }
    }
  }
}

export function deleteMatchingFields(
  documentId: string,
  document: Record<string, any>,
  fields: IgnoreFields[]
): void {
  const arrayRemovals: Array<{ parent: any[]; index: number }> = [];

  forEachMatchingField(documentId, document, fields, (result) => {
    if (Array.isArray(result.parent)) {
      arrayRemovals.push({ parent: result.parent, index: Number(result.parentProperty) });
    } else {
      delete result.parent[result.parentProperty];
    }
  });

  // Splice array elements in reverse index order to avoid shifting indices
  arrayRemovals.sort((a, b) => b.index - a.index);
  for (const { parent, index } of arrayRemovals) {
    parent.splice(index, 1);
  }
}

export function applyDocuments(
  documentId: string,
  sourceDocument: Record<string, any>,
  targetDocument: Record<string, any>,
  ignore: IgnoreFields[],
  skip: SkipFields[] = []
) {
  // Deep copy both documents so mutations (e.g. skip-field deletions) never affect the originals
  const mergedDocument = JSON.parse(JSON.stringify(sourceDocument));

  // Merge top-level properties of targetDocument
  const clonedTarget = JSON.parse(JSON.stringify(targetDocument));
  for (const [key, value] of Object.entries(clonedTarget)) {
    mergedDocument[key] = value;
  }

  // Restore ignored fields from source document
  forEachMatchingField(documentId, sourceDocument, ignore, (result) => {
    JSONPointer.set(mergedDocument, result.pointer, result.value);
  });

  // Remove skip fields from merged document
  deleteMatchingFields(documentId, mergedDocument, skip);

  return mergedDocument;
}
