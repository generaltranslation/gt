import { StringPart } from '../../nodes/types';

/**
 * Concatenates only the static parts, dropping dynamic/derive parts.
 * Callers must ensure non-static parts are intentionally discarded.
 */
export function joinStaticParts(parts: StringPart[]): string {
  return parts
    .filter((p) => p.type === 'static')
    .map((p) => p.content)
    .join('');
}

/**
 * Concatenates all parts into a single string, replacing
 * non-static parts with ICU-style `{0}`, `{1}`, ... placeholders.
 *
 * Constructs a string for uninterpolation.
 */
export function joinAllParts(parts: StringPart[]): string {
  let varIndex = 0;
  return parts
    .map((p) => (p.type === 'static' ? p.content : `{${varIndex++}}`))
    .join('');
}
