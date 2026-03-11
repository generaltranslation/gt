export const DECLARE_VAR_FUNCTION = 'declareVar';
export const DECLARE_STATIC_FUNCTION = 'declareStatic';
export const MSG_REGISTRATION_FUNCTION = 'msg';
export const INLINE_TRANSLATION_HOOK = 'useGT';
export const INLINE_TRANSLATION_HOOK_ASYNC = 'getGT';
export const INLINE_MESSAGE_HOOK = 'useMessages';
export const INLINE_MESSAGE_HOOK_ASYNC = 'getMessages';
export const TRANSLATION_COMPONENT = 'T';
export const STATIC_COMPONENT = 'Static';
export const BRANCH_COMPONENT = 'Branch';

// GT translation functions
export const GT_TRANSLATION_FUNCS = [
  INLINE_TRANSLATION_HOOK,
  INLINE_TRANSLATION_HOOK_ASYNC,
  INLINE_MESSAGE_HOOK,
  INLINE_MESSAGE_HOOK_ASYNC,
  MSG_REGISTRATION_FUNCTION,
  DECLARE_VAR_FUNCTION,
  DECLARE_STATIC_FUNCTION,
  TRANSLATION_COMPONENT,
  STATIC_COMPONENT,
  'Var',
  'DateTime',
  'Currency',
  'Num',
  BRANCH_COMPONENT,
  'Plural',
];
// Valid variable components
export const VARIABLE_COMPONENTS = [
  'Var',
  'DateTime',
  'Currency',
  'Num',
  STATIC_COMPONENT,
];

export const GT_ATTRIBUTES_WITH_SUGAR = [
  '$id',
  '$context',
  '$maxChars',
] as const;

export const GT_ATTRIBUTES = [
  'id',
  'context',
  'maxChars',
  ...GT_ATTRIBUTES_WITH_SUGAR,
] as const;

// Data attribute prefix injected by build tools
export const DATA_ATTR_PREFIX = 'data-' as const;

// Number of source code lines to capture above and below a translation site
export const SURROUNDING_LINE_COUNT = 5;
