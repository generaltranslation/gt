import { TSESTree } from '@typescript-eslint/utils';

/** Exports no components. */
export const CORE_LIBRARY = 'generaltranslation';

export const GT_LIBRARIES = [
  'gt-react',
  'gt-next',
  'gt-react-native',
  'gt-tanstack-start',
  'gt-i18n',
  '@generaltranslation/react-core/components',
  '@generaltranslation/react-core/components-rsc',
  '@generaltranslation/react-core/hooks',
  '@generaltranslation/react-core/pure',
  CORE_LIBRARY,
];

export type GTLibrary = (typeof GT_LIBRARIES)[number];

const COMPAT_SUBPATH = /\/compat(?:\/.*)?$/;

/**
 * Whether an import source is a library's dictionary (compat) entry, such as
 * 'gt-next/compat' or 'gt-next/compat/server'.
 */
export function isCompatSource(source: string): boolean {
  return COMPAT_SUBPATH.test(source);
}

/**
 * Whether an import source is one of the libraries or its dictionary (compat)
 * entry.
 */
export function isGTLibrarySource(
  libs: readonly string[],
  source: string
): boolean {
  return (
    libs.includes(source) || libs.includes(source.replace(COMPAT_SUBPATH, ''))
  );
}

// Components
export const T_COMPONENT_NAME = 'T';
export const VAR_COMPONENT_NAME = 'Var';
export const NUM_COMPONENT_NAME = 'Num';
export const CURRENCY_COMPONENT_NAME = 'Currency';
export const DATE_TIME_COMPONENT_NAME = 'DateTime';
export const DERIVE_COMPONENT_NAME = 'Derive';
export const SELECT_COMPONENT_NAME = 'Select';
export const PLURAL_COMPONENT_NAME = 'Plural';
export const ORDINAL_COMPONENT_NAME = 'Ordinal';

// Functions
export const USE_MESSAGES_FUNCTION_NAME = 'useMessages';
export const GET_MESSAGES_FUNCTION_NAME = 'getMessages';
export const MSG_FUNCTION_NAME = 'msg';

export const GT_COMPONENT_NAMES = [
  T_COMPONENT_NAME,
  VAR_COMPONENT_NAME,
  NUM_COMPONENT_NAME,
  CURRENCY_COMPONENT_NAME,
  DATE_TIME_COMPONENT_NAME,
  DERIVE_COMPONENT_NAME,
];

export const VARIABLE_COMPONENT_NAMES = [
  VAR_COMPONENT_NAME,
  NUM_COMPONENT_NAME,
  CURRENCY_COMPONENT_NAME,
  DATE_TIME_COMPONENT_NAME,
];

export const BRANCH_COMPONENT_NAMES = [
  SELECT_COMPONENT_NAME,
  PLURAL_COMPONENT_NAME,
  ORDINAL_COMPONENT_NAME,
];

// Error: any non-string literal, number literal, boolean literal, null literal, template literal (no interpolation)
export const ALLOWED_JSX_EXPRESSIONS = [
  TSESTree.AST_NODE_TYPES.Literal,
  TSESTree.AST_NODE_TYPES.TemplateLiteral,
];

// For branch attributes, we allow:
// Literal, TemplateLiteral (no interpolation), Jsx Stuff
export const ALLOWED_BRANCH_ATTRIBUTE_JSX_EXPRESSIONS = [
  ...ALLOWED_JSX_EXPRESSIONS,
  TSESTree.AST_NODE_TYPES.JSXElement,
  TSESTree.AST_NODE_TYPES.JSXFragment,
];

export const RULE_URL =
  'https://generaltranslation.com/docs/react-core-linter/rules/';
