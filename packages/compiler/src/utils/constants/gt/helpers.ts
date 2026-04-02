/**
 * Analysis utilities for identifying GT components and functions
 */

import {
  GT_ALL_FUNCTIONS,
  GT_CALLBACK_FUNCTIONS,
  GT_COMPONENT_TYPES,
  GT_FUNCTIONS_WITH_CALLBACKS,
  GT_IMPORT_SOURCES,
  MINIFY_CANONICAL_NAME_MAP,
} from './constants';
import {
  HTML_CONTENT_PROPS,
  HtmlContentPropValuesRecord,
} from 'generaltranslation/types';

/**
 * Check if a name is a GT function
 * @param name - The name to check
 * @returns True if the name is a GT function
 */
export function isGTFunction(name: string): name is GT_ALL_FUNCTIONS {
  return [
    'useGT',
    'getGT',
    'useTranslations',
    'getTranslations',
    'useMessages',
    'getMessages',
    'msg',
    't',
    'useGT_callback',
    'getGT_callback',
    'useTranslations_callback',
    'getTranslations_callback',
    'useMessages_callback',
    'getMessages_callback',
    'T',
    'Tx',
    'Var',
    'Static',
    'Derive',
    'Currency',
    'DateTime',
    'Num',
    'Branch',
    'Plural',
    'GtInternalTranslateJsx',
    'GtInternalVar',
    'GtInternalNum',
    'GtInternalCurrency',
    'GtInternalDateTime',
  ].includes(name);
}

/**
 * Check if a name is a GT function with callbacks
 * @param name - The name to check
 * @returns True if the name is a GT function with callbacks
 */
export function isGTFunctionWithCallbacks(
  name: string
): name is GT_FUNCTIONS_WITH_CALLBACKS {
  return [
    'useGT',
    'getGT',
    'useTranslations',
    'getTranslations',
    'useMessages',
    'getMessages',
  ].includes(name);
}

/**
 * Check if a name is a GT component
 * @param name - The name to check
 * @returns True if the name is a GT component
 */
export function isGTComponent(name: string): name is GT_COMPONENT_TYPES {
  return Object.values(GT_COMPONENT_TYPES).includes(name as GT_COMPONENT_TYPES);
}

/**
 * Check if a component name matches known gt-next translation components
 */
export function isTranslationComponent(
  name: string
): name is GT_COMPONENT_TYPES.T {
  return [
    GT_COMPONENT_TYPES.T,
    GT_COMPONENT_TYPES.GtInternalTranslateJsx,
  ].includes(name as GT_COMPONENT_TYPES);
}

/**
 * Check if a component name matches known gt-next variable components
 */
export function isVariableComponent(name: string): name is GT_COMPONENT_TYPES {
  return (
    [
      GT_COMPONENT_TYPES.Var,
      GT_COMPONENT_TYPES.Num,
      GT_COMPONENT_TYPES.Currency,
      GT_COMPONENT_TYPES.DateTime,
      GT_COMPONENT_TYPES.Derive,
      GT_COMPONENT_TYPES.Static,
      GT_COMPONENT_TYPES.GtInternalVar,
      GT_COMPONENT_TYPES.GtInternalNum,
      GT_COMPONENT_TYPES.GtInternalCurrency,
      GT_COMPONENT_TYPES.GtInternalDateTime,
    ] as string[]
  ).includes(name);
}

/**
 * Check if a name is a GT derive component
 */
export function isDeriveComponent(name: string): name is GT_COMPONENT_TYPES {
  return [GT_COMPONENT_TYPES.Derive, GT_COMPONENT_TYPES.Static].includes(
    name as GT_COMPONENT_TYPES
  );
}

/** @deprecated Use `isDeriveComponent` instead. */
export const isStaticComponent = isDeriveComponent;
/**
 * Check if a name is a GT branch component
 */
export function isBranchComponent(name: string): name is GT_COMPONENT_TYPES {
  return (
    [GT_COMPONENT_TYPES.Branch, GT_COMPONENT_TYPES.Plural] as string[]
  ).includes(name);
}

/**
 * Check if a name is a GT translation function
 */
export function isTranslationFunction(name: string): name is 'useGT' | 'getGT' {
  return ['useGT', 'getGT'].includes(name);
}

/**
 * Check if it's a translation function callback (const t = useGT())
 */
export function isTranslationFunctionCallback(
  name: string
): name is GT_CALLBACK_FUNCTIONS {
  return [
    'useGT_callback',
    'getGT_callback',
    'useTranslations_callback',
    'getTranslations_callback',
    'useMessages_callback',
    'getMessages_callback',
  ].includes(name);
}

/**
 * Check if it's a special Jsx function
 */
export function isJsxFunction(name: string): boolean {
  return ['jsxDEV', 'jsx', 'jsxs', 'React.createElement'].includes(name);
}

/**
 * Check if it's a GT import source
 */
export function isGTImportSource(name: string): name is GT_IMPORT_SOURCES {
  return (
    [
      GT_IMPORT_SOURCES.GT_NEXT,
      GT_IMPORT_SOURCES.GT_NEXT_CLIENT,
      GT_IMPORT_SOURCES.GT_NEXT_SERVER,
      GT_IMPORT_SOURCES.GT_REACT,
      GT_IMPORT_SOURCES.GT_REACT_CLIENT,
      GT_IMPORT_SOURCES.GT_REACT_BROWSER,
      GT_IMPORT_SOURCES.GT_I18N,
    ] as string[]
  ).includes(name);
}

/**
 * Check if is a html content prop
 */
export function isHtmlContentProp(
  name: string
): name is keyof HtmlContentPropValuesRecord {
  return Object.values(HTML_CONTENT_PROPS).includes(
    name as keyof HtmlContentPropValuesRecord
  );
}

/**
 * Minify the canonical name
 */
export function minifyCanonicalName(canonicalName: GT_COMPONENT_TYPES): string {
  return (
    MINIFY_CANONICAL_NAME_MAP[
      canonicalName as keyof typeof MINIFY_CANONICAL_NAME_MAP
    ] || canonicalName
  );
}

/**
 * Default variable names
 */
export const defaultVariableNames = {
  [GT_COMPONENT_TYPES.Var]: 'value',
  [GT_COMPONENT_TYPES.GtInternalVar]: 'value',
  [GT_COMPONENT_TYPES.Num]: 'n',
  [GT_COMPONENT_TYPES.GtInternalNum]: 'n',
  [GT_COMPONENT_TYPES.DateTime]: 'date',
  [GT_COMPONENT_TYPES.GtInternalDateTime]: 'date',
  [GT_COMPONENT_TYPES.Currency]: 'cost',
  [GT_COMPONENT_TYPES.GtInternalCurrency]: 'cost',
  [GT_COMPONENT_TYPES.Derive]: 'static',
  [GT_COMPONENT_TYPES.Static]: 'static',
} as const;
const baseVariablePrefix = '_gt_';

/**
 * Get the variable name
 */
export function getVariableName(
  variableType: keyof typeof defaultVariableNames,
  id: number,
  name?: string
): string {
  if (name) return name;
  const baseVariableName = defaultVariableNames[variableType] || 'value';
  return `${baseVariablePrefix}${baseVariableName}_${id}`;
}
