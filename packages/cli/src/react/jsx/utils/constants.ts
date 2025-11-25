export const MSG_TRANSLATION_HOOK = 'msg';
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
  MSG_TRANSLATION_HOOK,
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

export const GT_ATTRIBUTES_WITH_SUGAR = ['$id', '$context'];

export const GT_ATTRIBUTES = ['id', 'context', ...GT_ATTRIBUTES_WITH_SUGAR];

export function mapAttributeName(attrName: string): string {
  if (attrName === '$id') return 'id';
  if (attrName === '$context') return 'context';
  return attrName;
}

export const GT_LIBRARIES = [
  'gt-react',
  'gt-next',
  'gt-react-native',
  'gt-i18n',
  '@generaltranslation/react-core',
] as const;
export type GTLibraries = (typeof GT_LIBRARIES)[number];
export const GT_LIBRARIES_UPSTREAM: Record<GTLibraries, GTLibraries[]> = {
  'gt-next': [
    'gt-i18n',
    '@generaltranslation/react-core',
    'gt-react',
    'gt-next',
  ],
  'gt-react': ['gt-i18n', '@generaltranslation/react-core', 'gt-react'],
  'gt-react-native': [
    'gt-i18n',
    '@generaltranslation/react-core',
    'gt-react-native',
  ],
  '@generaltranslation/react-core': [
    'gt-i18n',
    '@generaltranslation/react-core',
  ],
  'gt-i18n': ['gt-i18n'],
} as const;
