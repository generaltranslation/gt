// GT translation functions
export const GT_TRANSLATION_FUNCS = [
  'useGT',
  'getGT',
  'T',
  'Var',
  'DateTime',
  'Currency',
  'Num',
  'Branch',
  'Plural',
];
// Valid variable components
export const VARIABLE_COMPONENTS = ['Var', 'DateTime', 'Currency', 'Num'];

export const GT_ATTRIBUTES = ['$id', '$context'];

export function mapAttributeName(attrName: string): string {
  if (attrName === '$id') return 'id';
  if (attrName === '$context') return 'context';
  return attrName;
}
