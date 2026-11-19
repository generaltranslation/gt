import type { VariableType } from '@generaltranslation/format';

/**
 * Different gt components
 */
export enum GT_COMPONENT_TYPES {
  T = 'T',
  Tx = 'Tx',
  Var = 'Var',
  Currency = 'Currency',
  DateTime = 'DateTime',
  RelativeTime = 'RelativeTime',
  Num = 'Num',
  N = 'N',
  Derive = 'Derive',
  Branch = 'Branch',
  Plural = 'Plural',
  LocaleSelector = 'LocaleSelector',
  GtInternalTranslateJsx = 'GtInternalTranslateJsx',
  GtInternalVar = 'GtInternalVar',
  GtInternalNum = 'GtInternalNum',
  GtInternalCurrency = 'GtInternalCurrency',
  GtInternalDateTime = 'GtInternalDateTime',
}

/**
 * Other GT functions
 */
export enum GT_OTHER_FUNCTIONS {
  derive = 'derive',
  GtInternalRuntimeTranslateJsx = 'GtInternalRuntimeTranslateJsx',
}

/**
 * All gt functions and components
 */
export type GT_ALL_FUNCTIONS = GT_OTHER_FUNCTIONS | GT_COMPONENT_TYPES;

/**
 * GT import sources
 */
export enum GT_IMPORT_SOURCES {
  GT_NEXT = 'gt-next',
  GT_NEXT_SERVER = 'gt-next/server',
  GT_REACT = 'gt-react',
  GT_I18N = 'gt-i18n',
  GT_TANSTACK_START = 'gt-tanstack-start',
}

/**
 * Branch control props — not translatable content.
 * `branch` is the selector key; `data-*` props are HTML attributes ignored at runtime.
 * `data-*` is handled as a prefix check, not listed here.
 */
export const BRANCH_CONTROL_PROPS = new Set(['branch']);

/**
 * Plural control props — not translatable content.
 * `n` is the count.
 */
export const PLURAL_CONTROL_PROPS = new Set(['n']);

/**
 * Option keys the compiler writes into injected calls
 */
export enum TRANSLATION_OPTION_KEYS {
  $id = '$id',
  $context = '$context',
  $_hash = '$_hash',
  $requiresReview = '$requiresReview',
}

/**
 * The variable components, each with the type its variable is stored as
 */
export const VARIABLE_COMPONENT_TYPES = {
  [GT_COMPONENT_TYPES.Var]: 'v',
  [GT_COMPONENT_TYPES.GtInternalVar]: 'v',
  [GT_COMPONENT_TYPES.Num]: 'n',
  [GT_COMPONENT_TYPES.GtInternalNum]: 'n',
  [GT_COMPONENT_TYPES.Currency]: 'c',
  [GT_COMPONENT_TYPES.GtInternalCurrency]: 'c',
  [GT_COMPONENT_TYPES.DateTime]: 'd',
  [GT_COMPONENT_TYPES.GtInternalDateTime]: 'd',
  [GT_COMPONENT_TYPES.RelativeTime]: 'rt',
  [GT_COMPONENT_TYPES.N]: '#',
} as const satisfies Partial<Record<GT_COMPONENT_TYPES, VariableType>>;

export type VariableComponent = keyof typeof VARIABLE_COMPONENT_TYPES;
