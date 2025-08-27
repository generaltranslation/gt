export const MSG_TRANSLATION_HOOK = 'msg';
export const INLINE_TRANSLATION_HOOK = 'useGT';
export const INLINE_TRANSLATION_HOOK_ASYNC = 'getGT';
export const INLINE_MESSAGE_HOOK = 'useMessages';
export const INLINE_MESSAGE_HOOK_ASYNC = 'getMessages';

// GT translation functions
export const GT_TRANSLATION_FUNCS = [
  INLINE_TRANSLATION_HOOK,
  INLINE_TRANSLATION_HOOK_ASYNC,
  INLINE_MESSAGE_HOOK,
  INLINE_MESSAGE_HOOK_ASYNC,
  MSG_TRANSLATION_HOOK,
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

export const GT_ATTRIBUTES_WITH_SUGAR = ['$id', '$context'];

export const GT_ATTRIBUTES = ['id', 'context', ...GT_ATTRIBUTES_WITH_SUGAR];

export function mapAttributeName(attrName: string): string {
  if (attrName === '$id') return 'id';
  if (attrName === '$context') return 'context';
  return attrName;
}
