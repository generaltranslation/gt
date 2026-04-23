import { StringPart } from '../../nodes/types';

/**
 * Collapses an array of StringParts into a single string
 * @param parts - The array of StringParts to collapse
 * @returns The collapsed string
 */
export function collapseStringPartsToString(parts: StringPart[]): string {
  return parts
    .filter((p) => p.type === 'static')
    .map((p) => p.content)
    .join('');
}
