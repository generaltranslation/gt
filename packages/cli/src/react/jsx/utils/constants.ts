export const DECLARE_VAR_FUNCTION = 'declareVar';
/**
 * COMPAT: Legacy support for declareStatic function.
 */
export const DECLARE_STATIC_FUNCTION = 'declareStatic';
export const DERIVE_FUNCTION = 'derive';
export const MSG_REGISTRATION_FUNCTION = 'msg';
export const T_REGISTRATION_FUNCTION = 't';
export const T_GLOBAL_REGISTRATION_FUNCTION = 't';
export const INLINE_TRANSLATION_HOOK = 'useGT';
export const INLINE_TRANSLATION_HOOK_ASYNC = 'getGT';
export const INLINE_MESSAGE_HOOK = 'useMessages';
export const INLINE_MESSAGE_HOOK_ASYNC = 'getMessages';
export const TRANSLATION_COMPONENT = 'T';
/**
 * COMPAT: Legacy support for Static component.
 */
export const STATIC_COMPONENT = 'Static';
export const DERIVE_COMPONENT = 'Derive';
export const BRANCH_COMPONENT = 'Branch';

// GT translation functions
export const GT_TRANSLATION_FUNCS = [
  INLINE_TRANSLATION_HOOK,
  INLINE_TRANSLATION_HOOK_ASYNC,
  INLINE_MESSAGE_HOOK,
  INLINE_MESSAGE_HOOK_ASYNC,
  MSG_REGISTRATION_FUNCTION,
  T_REGISTRATION_FUNCTION,
  DECLARE_VAR_FUNCTION,
  DECLARE_STATIC_FUNCTION,
  DERIVE_FUNCTION,
  TRANSLATION_COMPONENT,
  STATIC_COMPONENT,
  DERIVE_COMPONENT,
  'Var',
  'DateTime',
  'Currency',
  'Num',
  BRANCH_COMPONENT,
  'Plural',
];
// GT String translation functions
export const STRING_REGISTRATION_FUNCS = [
  MSG_REGISTRATION_FUNCTION,
  T_REGISTRATION_FUNCTION,
] as const;

// Derive functions that are imported from GT
export const GT_DERIVE_FUNCTIONS = [DECLARE_STATIC_FUNCTION, DERIVE_FUNCTION];

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

// Data attribute prefix injected by build tools
export const DATA_ATTR_PREFIX = 'data-' as const;

// demarcation for global t macro
export const T_GLOBAL_REGISTRATION_FUNCTION_MARKER =
  '_gt_internal_t_global_registration_marker';
