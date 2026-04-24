import { StringPart } from '../../nodes/types';

/**
 * Collapses an array of StringParts into a single string
 * @param parts - The array of StringParts to collapse
 * @returns The collapsed string
 */
export function collapseStringPartsToString(parts: StringPart[]): string;
export function collapseStringPartsToString(
  parts: StringPart[],
  uninterpolate: boolean
): string;
export function collapseStringPartsToString(
  parts: StringPart[],
  uninterpolate: boolean = false
): string {
  if (uninterpolate) {
    let varIndex = 0;
    return parts
      .map((p) => (p.type === 'static' ? p.content : `{${varIndex++}}`))
      .join('');
  }
  return parts
    .filter((p) => p.type === 'static')
    .map((p) => p.content)
    .join('');
}
