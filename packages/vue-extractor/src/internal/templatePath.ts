/** Internal segment reserved for an unresolved object key. */
export const unknownTemplatePathSegment = '%GT_UNKNOWN%';

/** Internal segment marking a GT-bearing identity reachable through a cycle. */
export const recursiveTemplatePathSegment = '%GT_RECURSIVE%';

/**
 * Appends one property to a flattened template-binding path.
 *
 * Dots delimit JavaScript member segments internally, so literal dots and
 * percent escapes in property names must be encoded before concatenation.
 * This keeps `value.a.b` distinct from `value['a.b']`.
 */
export function appendTemplatePath(path: string, property: string): string {
  return `${path}.${encodeTemplatePathSegment(property)}`;
}

/** Encodes the only characters that can collide with the path wire format. */
function encodeTemplatePathSegment(segment: string): string {
  return segment.replace(/%/g, '%25').replace(/\./g, '%2E');
}
