export const DECLARE_VAR_FUNCTION = 'declareVar';
/**
 * COMPAT: Legacy support for declareStatic function.
 */
export const DECLARE_STATIC_FUNCTION = 'declareStatic';
export const DERIVE_FUNCTION = 'derive';
export const MSG_REGISTRATION_FUNCTION = 'msg';
export const T_REGISTRATION_FUNCTION = 't';
export const T_GLOBAL_REGISTRATION_FUNCTION = T_REGISTRATION_FUNCTION;
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
export const DEFAULT_GT_IMPORT_SOURCE = 'gt-react/browser';
export const INTERNAL_TRANSLATION_COMPONENT = 'GtInternalTranslateJsx';
export const INTERNAL_VAR_COMPONENT = 'GtInternalVar';

// Variable components
export const VAR_COMPONENT = 'Var';
export const DATETIME_COMPONENT = 'DateTime';
export const RELATIVE_TIME_COMPONENT = 'RelativeTime';
export const CURRENCY_COMPONENT = 'Currency';
export const NUM_COMPONENT = 'Num';
export const PLURAL_COMPONENT = 'Plural';

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
  VAR_COMPONENT,
  DATETIME_COMPONENT,
  RELATIVE_TIME_COMPONENT,
  CURRENCY_COMPONENT,
  NUM_COMPONENT,
  BRANCH_COMPONENT,
  INTERNAL_TRANSLATION_COMPONENT,
  INTERNAL_VAR_COMPONENT,
  PLURAL_COMPONENT,
];
// GT String translation functions
export const STRING_REGISTRATION_FUNCS = [
  MSG_REGISTRATION_FUNCTION,
  T_REGISTRATION_FUNCTION,
] as const;

// Derive functions that are imported from GT
export const GT_DERIVE_STRING_FUNCTIONS = [
  DECLARE_STATIC_FUNCTION,
  DERIVE_FUNCTION,
];

// Valid variable components
export const VARIABLE_COMPONENTS = [
  VAR_COMPONENT,
  DATETIME_COMPONENT,
  RELATIVE_TIME_COMPONENT,
  CURRENCY_COMPONENT,
  NUM_COMPONENT,
  STATIC_COMPONENT,
  DERIVE_COMPONENT,
  INTERNAL_VAR_COMPONENT,
];

export const GT_ATTRIBUTES_WITH_SUGAR = [
  '$id',
  '$context',
  '$maxChars',
  '$format',
] as const;

export const GT_ATTRIBUTES = [
  'id',
  'context',
  'maxChars',
  ...GT_ATTRIBUTES_WITH_SUGAR,
] as const;

// Data attribute prefix injected by build tools
export const DATA_ATTR_PREFIX = 'data-' as const;

/** Branch control props — not translatable content. */
export const BRANCH_CONTROL_PROPS = new Set(['branch']);

/** Plural control props — not translatable content. */
export const PLURAL_CONTROL_PROPS = new Set(['n', 'locales']);

// demarcation for global t macro
export const T_GLOBAL_REGISTRATION_FUNCTION_MARKER =
  '_gt_internal_t_global_registration_marker';
