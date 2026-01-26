import { TSESTree } from '@typescript-eslint/utils';

export const GT_LIBRARIES = [
  'gt-react',
  'gt-next',
  'gt-react-native',
  'gt-i18n',
  '@generaltranslation/react-core',
];

export type GTLibrary = (typeof GT_LIBRARIES)[number];

// Components
export const T_COMPONENT_NAME = 'T';
export const VAR_COMPONENT_NAME = 'Var';
export const NUM_COMPONENT_NAME = 'Num';
export const CURRENCY_COMPONENT_NAME = 'Currency';
export const DATE_TIME_COMPONENT_NAME = 'DateTime';
export const STATIC_COMPONENT_NAME = 'Static';
export const BRANCH_COMPONENT_NAME = 'Branch';
export const PLURAL_COMPONENT_NAME = 'Plural';

// Functions
export const USE_GT_FUNCTION_NAME = 'useGT';
export const GET_GT_FUNCTION_NAME = 'getGT';
export const USE_TRANSLATIONS_FUNCTION_NAME = 'useTranslations';
export const GET_TRANSLATIONS_FUNCTION_NAME = 'getTranslations';
export const USE_MESSAGES_FUNCTION_NAME = 'useMessages';
export const GET_MESSAGES_FUNCTION_NAME = 'getMessages';
export const MSG_FUNCTION_NAME = 'msg';
export const DECLARE_STATIC_FUNCTION_NAME = 'declareStatic';

export const GT_COMPONENT_NAMES = [
  T_COMPONENT_NAME,
  VAR_COMPONENT_NAME,
  NUM_COMPONENT_NAME,
  CURRENCY_COMPONENT_NAME,
  DATE_TIME_COMPONENT_NAME,
  STATIC_COMPONENT_NAME,
];

export const VARIABLE_COMPONENT_NAMES = [
  VAR_COMPONENT_NAME,
  NUM_COMPONENT_NAME,
  CURRENCY_COMPONENT_NAME,
  DATE_TIME_COMPONENT_NAME,
];

export const BRANCH_COMPONENT_NAMES = [
  BRANCH_COMPONENT_NAME,
  PLURAL_COMPONENT_NAME,
];

// const gt = useGT(); const gt = await getGT();
export const GT_CALLBACK_DECLARATOR_FUNCTION_NAMES = [
  USE_GT_FUNCTION_NAME,
  GET_GT_FUNCTION_NAME,
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
