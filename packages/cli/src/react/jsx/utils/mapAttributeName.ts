/**
 * Type logic implementation
 */
type MapAttributeName<T extends string> = T extends '$id'
  ? 'id'
  : T extends '$context'
    ? 'context'
    : T extends '$maxChars'
      ? 'maxChars'
      : T extends '$format'
        ? 'format'
        : T extends '$requiresReview'
          ? 'requiresReview'
          : T;

/**
 * Map the attribute name to the corresponding attribute name in the metadata
 * @param attrName - The attribute name to map
 * @returns The mapped attribute name
 */
export function mapAttributeName<T extends string>(
  attrName: T
): MapAttributeName<T>;
export function mapAttributeName(attrName: string): string {
  switch (attrName) {
    case '$id':
      return 'id';
    case '$context':
      return 'context';
    case '$maxChars':
      return 'maxChars';
    case '$format':
      return 'format';
    case '$requiresReview':
      return 'requiresReview';
    default:
      return attrName;
  }
}
