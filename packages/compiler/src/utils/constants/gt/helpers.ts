/**
 * Analysis utilities for identifying GT components and functions
 */

import {
  GT_ALL_FUNCTIONS,
  GT_COMPONENT_TYPES,
  GT_IMPORT_SOURCES,
  VARIABLE_COMPONENT_TYPES,
  type VariableComponent,
} from './constants';
import {
  HTML_CONTENT_PROPS,
  HtmlContentPropValuesRecord,
} from '@generaltranslation/format';
import type { BranchElementName } from '@generaltranslation/format/internal';

/**
 * Check if a name is a GT function
 * @param name - The name to check
 * @returns True if the name is a GT function
 */
export function isGTFunction(name: string): name is GT_ALL_FUNCTIONS {
  return [
    'derive',
    'T',
    'Tx',
    'Var',
    'Derive',
    'Currency',
    'DateTime',
    'RelativeTime',
    'Num',
    'N',
    'Select',
    'Plural',
    'Ordinal',
    'GtInternalTranslateJsx',
    'GtInternalVar',
    'GtInternalNum',
    'GtInternalCurrency',
    'GtInternalDateTime',
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
export function isVariableComponent(name: string): name is VariableComponent {
  return Object.prototype.hasOwnProperty.call(VARIABLE_COMPONENT_TYPES, name);
}

/**
 * Check if a name is a GT derive component
 */
export function isDeriveComponent(name: string): name is GT_COMPONENT_TYPES {
  return name === GT_COMPONENT_TYPES.Derive;
}

/**
 * Check if a name is a GT plural component: a Plural or an Ordinal
 */
export function isPluralComponent(name: string | null): boolean {
  return (
    name === GT_COMPONENT_TYPES.Plural || name === GT_COMPONENT_TYPES.Ordinal
  );
}

/**
 * Check if a name is a GT branch component
 */
export function isBranchComponent(name: string): name is BranchElementName {
  return name === GT_COMPONENT_TYPES.Select || isPluralComponent(name);
}

/**
 * Check if it's a GT import source
 */
export function isGTImportSource(name: string): name is GT_IMPORT_SOURCES {
  return (
    [
      GT_IMPORT_SOURCES.GT_NEXT,
      GT_IMPORT_SOURCES.GT_NEXT_SERVER,
      GT_IMPORT_SOURCES.GT_REACT,
      GT_IMPORT_SOURCES.GT_I18N,
      GT_IMPORT_SOURCES.GT_TANSTACK_START,
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
