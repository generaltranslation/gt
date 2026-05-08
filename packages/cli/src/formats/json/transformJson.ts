import { StructuralTransform, SourceObjectOptions } from '../../types/index.js';
import type { JSONValue } from '../../types/data/json.js';
import { getJSONPathMatches } from './jsonPath.js';
import {
  deleteJSONPointerValue,
  getJSONPointerValue,
  setJSONPointerValue,
} from './jsonPointer.js';

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
  json: JSONValue,
  transforms: StructuralTransform[],
  compositeConfig: Record<string, SourceObjectOptions>
): JSONValue {
  const entryPaths = deriveEntryPaths(compositeConfig);

  for (const entryPath of entryPaths) {
    const entries = getJSONPathMatches(json, entryPath);
    if (!entries) continue;

    for (const entry of entries) {
      const entryObj = entry.value;
      if (typeof entryObj !== 'object' || entryObj === null) continue;

      for (const transform of transforms) {
        const sourceValue = getJSONPointerValue(
          entryObj,
          transform.sourcePointer
        );
        if (sourceValue !== undefined) {
          setJSONPointerValue(
            entryObj,
            transform.destinationPointer,
            sourceValue
          );
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
  json: JSONValue,
  transforms: StructuralTransform[],
  compositeConfig: Record<string, SourceObjectOptions>
): JSONValue {
  const entryPaths = deriveEntryPaths(compositeConfig);

  for (const entryPath of entryPaths) {
    const entries = getJSONPathMatches(json, entryPath);
    if (!entries) continue;

    for (const entry of entries) {
      const entryObj = entry.value;
      if (typeof entryObj !== 'object' || entryObj === null) continue;

      for (const transform of transforms) {
        try {
          deleteJSONPointerValue(entryObj, transform.destinationPointer);
        } catch {
          /* entry may not have the destination path */
        }
      }
    }
  }

  return json;
}
