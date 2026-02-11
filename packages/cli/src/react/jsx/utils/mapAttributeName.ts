/**
 * Map the attribute name to the corresponding attribute name in the metadata
 * @param attrName - The attribute name to map
 * @returns The mapped attribute name
 */
export function mapAttributeName(attrName: string): string {
  if (attrName === '$id') return 'id';
  if (attrName === '$context') return 'context';
  if (attrName === '$maxChars') return 'maxChars';
  return attrName;
}
