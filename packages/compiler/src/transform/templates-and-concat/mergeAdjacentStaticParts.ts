import { Part } from './flattenExpressionToParts';

/**
 * Collapse consecutive static parts by concatenating their values.
 */
export function mergeAdjacentStaticParts(parts: Part[]): Part[] {
  const merged: Part[] = [];
  for (const part of parts) {
    if (
      part.type === 'static' &&
      merged.length > 0 &&
      merged[merged.length - 1].type === 'static'
    ) {
      (merged[merged.length - 1] as { type: 'static'; value: string }).value +=
        part.value;
    } else {
      merged.push(part);
    }
  }
  return merged;
}
