/**
 * Different TYPES of gt components
 */
export enum GT_COMPONENT_CATEGORIES {
  TRANSLATION = 'T',
  VARIABLE = 'Var',
  BRANCH = 'Branch',
}

/**
 * Different gt components
 */
export enum GT_COMPONENT_TYPES {
  T = 'T',
  Tx = 'Tx',
  Var = 'Var',
  Currency = 'Currency',
  DateTime = 'DateTime',
  Num = 'Num',
  Branch = 'Branch',
  Plural = 'Plural',
}

/**
 * GT functions that produce callbacks
 */
export enum GT_FUNCTIONS_WITH_CALLBACKS {
  useGT = 'useGT',
  getGT = 'getGT',
  useTranslations = 'useTranslations',
  getTranslations = 'getTranslations',
  useMessages = 'useMessages',
  getMessages = 'getMessages',
}

/**
 * Other GT functions
 */
export enum GT_OTHER_FUNCTIONS {
  msg = 'msg',
}

/**
 * Different gt functions
 */
export type GT_FUNCTIONS = GT_FUNCTIONS_WITH_CALLBACKS | GT_OTHER_FUNCTIONS;
/**
 * gt callback functions
 */
export enum GT_CALLBACK_FUNCTIONS {
  useGT_callback = 'useGT_callback',
  getGT_callback = 'getGT_callback',
  useTranslations_callback = 'useTranslations_callback',
  getTranslations_callback = 'getTranslations_callback',
  useMessages_callback = 'useMessages_callback',
  getMessages_callback = 'getMessages_callback',
}

/**
 * Maps GT Functions to their callback functions
 */
export const GT_FUNCTIONS_TO_CALLBACKS: Record<
  GT_FUNCTIONS_WITH_CALLBACKS,
  GT_CALLBACK_FUNCTIONS
> = {
  [GT_FUNCTIONS_WITH_CALLBACKS.useGT]: GT_CALLBACK_FUNCTIONS.useGT_callback,
  [GT_FUNCTIONS_WITH_CALLBACKS.getGT]: GT_CALLBACK_FUNCTIONS.getGT_callback,
  [GT_FUNCTIONS_WITH_CALLBACKS.useTranslations]:
    GT_CALLBACK_FUNCTIONS.useTranslations_callback,
  [GT_FUNCTIONS_WITH_CALLBACKS.getTranslations]:
    GT_CALLBACK_FUNCTIONS.getTranslations_callback,
  [GT_FUNCTIONS_WITH_CALLBACKS.useMessages]:
    GT_CALLBACK_FUNCTIONS.useMessages_callback,
  [GT_FUNCTIONS_WITH_CALLBACKS.getMessages]:
    GT_CALLBACK_FUNCTIONS.getMessages_callback,
};

/**
 * All gt functions (both regular and callback functions)
 */
export type GT_ALL_FUNCTIONS =
  | GT_FUNCTIONS
  | GT_CALLBACK_FUNCTIONS
  | GT_COMPONENT_TYPES;

/**
 * GT import sources
 */
export enum GT_IMPORT_SOURCES {
  GT_NEXT = 'gt-next',
  GT_NEXT_CLIENT = 'gt-next/client',
  GT_NEXT_SERVER = 'gt-next/server',
}

/**
 * Set of valid plural forms for Plural components
 */
export const PLURAL_FORMS = new Set([
  'singular',
  'plural',
  'dual',
  'zero',
  'one',
  'two',
  'few',
  'many',
  'other',
]);

/**
 * Fields that must be string literals for useGT_callback / getGT_callback
 */
export enum USEGT_CALLBACK_OPTIONS {
  $id = '$id',
  $context = '$context',
}
export const USEGT_CALLBACK_OPTION_NAMES = {
  [USEGT_CALLBACK_OPTIONS.$id]: 'id',
  [USEGT_CALLBACK_OPTIONS.$context]: 'context',
};

/**
 * Maps GT Component Types to their minified names
 */
export const MINIFY_CANONICAL_NAME_MAP = {
  [GT_COMPONENT_TYPES.Var]: 'v',
  [GT_COMPONENT_TYPES.Num]: 'n',
  [GT_COMPONENT_TYPES.Currency]: 'c',
  [GT_COMPONENT_TYPES.DateTime]: 'd',
  [GT_COMPONENT_TYPES.Branch]: 'b',
  [GT_COMPONENT_TYPES.Plural]: 'p',
} as const;
