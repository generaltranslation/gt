export const GT_LIBRARIES = [
  'gt-react',
  'gt-next',
  'gt-react-native',
  'gt-i18n',
  '@generaltranslation/react-core',
];

export type GTLibrary = (typeof GT_LIBRARIES)[number];

export const T_COMPONENT_NAME = 'T';

export const GT_COMPONENT_NAMES = [T_COMPONENT_NAME] as const;
