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
 * Different gt functions
 */
export enum GT_FUNCTIONS {
  useGT = 'useGT',
  getGT = 'getGT',
  useTranslations = 'useTranslations',
  getTranslations = 'getTranslations',
  useDict = 'useDict',
  getDict = 'getDict',
  msg = 'msg',
  useMessages = 'useMessages',
  getMessages = 'getMessages',
}

/**
 * gt callback functions
 */
export enum GT_CALLBACK_FUNCTIONS {
  useGT_callback = 'useGT_callback',
  getGT_callback = 'getGT_callback',
  useTranslations_callback = 'useTranslations_callback',
  getTranslations_callback = 'getTranslations_callback',
  useDict_callback = 'useDict_callback',
  getDict_callback = 'getDict_callback',
  useMessages_callback = 'useMessages_callback',
  getMessages_callback = 'getMessages_callback',
}

/**
 * All gt functions (both regular and callback functions)
 */
export type GT_ALL_FUNCTIONS = GT_FUNCTIONS | GT_CALLBACK_FUNCTIONS;
