export const DECLARE_VAR_FUNCTION = 'declareVar';
export const DECLARE_STATIC_FUNCTION = 'declareStatic';
export const MSG_REGISTRATION_FUNCTION = 'msg';
export const INLINE_TRANSLATION_HOOK = 'useGT';
export const INLINE_TRANSLATION_HOOK_ASYNC = 'getGT';
export const INLINE_MESSAGE_HOOK = 'useMessages';
export const INLINE_MESSAGE_HOOK_ASYNC = 'getMessages';
export const TRANSLATION_COMPONENT = 'T';
export const STATIC_COMPONENT = 'Static';

// GT translation functions
export const GT_TRANSLATION_FUNCS = [
  INLINE_TRANSLATION_HOOK,
  INLINE_TRANSLATION_HOOK_ASYNC,
  INLINE_MESSAGE_HOOK,
  INLINE_MESSAGE_HOOK_ASYNC,
  MSG_REGISTRATION_FUNCTION,
  DECLARE_VAR_FUNCTION,
  DECLARE_STATIC_FUNCTION,
  TRANSLATION_COMPONENT,
  STATIC_COMPONENT,
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

export function mapAttributeName(attrName: string): string {
  if (attrName === '$id') return 'id';
  if (attrName === '$context') return 'context';
  if (attrName === '$maxChars') return 'maxChars';
  return attrName;
}

export enum Libraries {
  GT_REACT = 'gt-react',
  GT_NEXT = 'gt-next',
  GT_REACT_NATIVE = 'gt-react-native',
  GT_NODE = 'gt-node',
  GT_I18N = 'gt-i18n',
  REACT_CORE = '@generaltranslation/react-core',
}

export const GT_LIBRARIES = [
  Libraries.GT_REACT,
  Libraries.GT_NEXT,
  Libraries.GT_REACT_NATIVE,
  Libraries.GT_NODE,
  Libraries.GT_I18N,
  Libraries.REACT_CORE,
] as const;
export type GTLibrary = (typeof GT_LIBRARIES)[number];

/**
 * GT Libraries that use react translations
 */
export type GTReactLibrary =
  | 'gt-react'
  | 'gt-react-native'
  | 'gt-next'
  | '@generaltranslation/react-core';

/**
 * A mapping of each library to their upstream dependencies for filtering imports
 */
export const GT_LIBRARIES_UPSTREAM: Record<GTLibrary, GTLibrary[]> = {
  [Libraries.GT_NEXT]: [
    Libraries.GT_I18N,
    Libraries.REACT_CORE,
    Libraries.GT_REACT,
    Libraries.GT_NEXT,
  ],
  [Libraries.GT_REACT]: [
    Libraries.GT_I18N,
    Libraries.REACT_CORE,
    Libraries.GT_REACT,
    Libraries.GT_REACT_NATIVE, // allow for cross-library compatibility (gt-react/gt-react-native only)
  ],
  [Libraries.GT_REACT_NATIVE]: [
    Libraries.GT_I18N,
    Libraries.REACT_CORE,
    Libraries.GT_REACT_NATIVE,
    Libraries.GT_REACT, // allow for cross-library compatibility (gt-react/gt-react-native only)
  ],
  [Libraries.GT_NODE]: [
    Libraries.GT_I18N,
    Libraries.REACT_CORE,
    Libraries.GT_NODE,
  ],
  [Libraries.REACT_CORE]: [Libraries.GT_I18N, Libraries.REACT_CORE],
  [Libraries.GT_I18N]: [Libraries.GT_I18N],
} as const;
