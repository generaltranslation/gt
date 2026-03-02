export const DECLARE_VAR_FUNCTION = 'declareVar';
export const DECLARE_STATIC_FUNCTION = 'declareStatic';
export const DECLARE_DERIVE_FUNCTION = 'derive';
export const MSG_REGISTRATION_FUNCTION = 'msg';
export const INLINE_TRANSLATION_HOOK = 'useGT';
export const INLINE_TRANSLATION_HOOK_ASYNC = 'getGT';
export const INLINE_MESSAGE_HOOK = 'useMessages';
export const INLINE_MESSAGE_HOOK_ASYNC = 'getMessages';
export const TRANSLATION_COMPONENT = 'T';
export const STATIC_COMPONENT = 'Static';
export const DERIVE_COMPONENT = 'Derive';

// GT translation functions
export const GT_TRANSLATION_FUNCS = [
  INLINE_TRANSLATION_HOOK,
  INLINE_TRANSLATION_HOOK_ASYNC,
  INLINE_MESSAGE_HOOK,
  INLINE_MESSAGE_HOOK_ASYNC,
  MSG_REGISTRATION_FUNCTION,
  DECLARE_VAR_FUNCTION,
  DECLARE_STATIC_FUNCTION,
  DECLARE_DERIVE_FUNCTION,
  TRANSLATION_COMPONENT,
  STATIC_COMPONENT,
  DERIVE_COMPONENT,
  'Var',
  'DateTime',
  'Currency',
  'Num',
  'Branch',
  'Plural',
];
// Valid variable components
export const VARIABLE_COMPONENTS = [
  'Var',
  'DateTime',
  'Currency',
  'Num',
  STATIC_COMPONENT,
  DERIVE_COMPONENT,
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
