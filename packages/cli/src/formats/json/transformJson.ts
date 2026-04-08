import JSONPointer from 'jsonpointer';
import { StructuralTransform, SourceObjectOptions } from '../../types/index.js';
import { JSONPath } from 'jsonpath-plus';

/**
 * Derive entry parent paths from composite sourceObjectPaths by trimming the last segment.
 * e.g., "$.*.translations" → "$.*"
 */
function deriveEntryPaths(
  compositeConfig: Record<string, SourceObjectOptions>
): string[] {
  const entryPaths = new Set<string>();
  for (const sourceObjectPath of Object.keys(compositeConfig)) {
    const lastDot = sourceObjectPath.lastIndexOf('.');
    if (lastDot > 0) {
      entryPaths.add(sourceObjectPath.substring(0, lastDot));
    }
  }
  return [...entryPaths];
}

/**
 * Apply structural transforms: copy values from sourcePointer to destinationPointer
 * for each entry resolved by the composite config's parent paths.
 * Mutates json in-place.
 */
export function applyStructuralTransforms(
  json: any,
  transforms: StructuralTransform[],
  compositeConfig: Record<string, SourceObjectOptions>
): any {
  const entryPaths = deriveEntryPaths(compositeConfig);

  for (const entryPath of entryPaths) {
    const entries = JSONPath({
      json,
      path: entryPath,
      resultType: 'all',
      flatten: true,
      wrap: true,
    });
    if (!entries) continue;

    for (const entry of entries) {
      const entryObj = entry.value;
      if (typeof entryObj !== 'object' || entryObj === null) continue;

      for (const transform of transforms) {
        const sourceValue = JSONPointer.get(entryObj, transform.sourcePointer);
        if (sourceValue !== undefined) {
          JSONPointer.set(entryObj, transform.destinationPointer, sourceValue);
        }
      }
    }
  }

  return json;
}

/**
 * Unapply structural transforms: delete the value at destinationPointer
 * for each entry resolved by the composite config's parent paths.
 * Leaves sourcePointer untouched. Mutates json in-place.
 */
export function unapplyStructuralTransforms(
  json: any,
  transforms: StructuralTransform[],
  compositeConfig: Record<string, SourceObjectOptions>
): any {
  const entryPaths = deriveEntryPaths(compositeConfig);

  for (const entryPath of entryPaths) {
    const entries = JSONPath({
      json,
      path: entryPath,
      resultType: 'all',
      flatten: true,
      wrap: true,
    });
    if (!entries) continue;

    for (const entry of entries) {
      const entryObj = entry.value;
      if (typeof entryObj !== 'object' || entryObj === null) continue;

      for (const transform of transforms) {
        // Navigate to parent of destinationPointer and delete the leaf key
        const pointer = transform.destinationPointer;
        const lastSlash = pointer.lastIndexOf('/');
        if (lastSlash < 0) continue;

        const parentPointer = pointer.substring(0, lastSlash) || '';
        const leafKey = pointer.substring(lastSlash + 1);

        try {
          const parent = parentPointer
            ? JSONPointer.get(entryObj, parentPointer)
            : entryObj;
          if (parent && typeof parent === 'object' && leafKey in parent) {
            delete parent[leafKey];
          }
        } catch {
          /* entry may not have the destination path */
        }
      }
    }
  }

  return json;
}
