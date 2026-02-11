/**
 * A list of all the libraries names supported by the CLI
 */
export enum Libraries {
  GT_REACT = 'gt-react',
  GT_NEXT = 'gt-next',
  GT_REACT_NATIVE = 'gt-react-native',
  GT_NODE = 'gt-node',
  GT_I18N = 'gt-i18n',
  GT_REACT_CORE = '@generaltranslation/react-core',
}

/**
 * A list of all the libraries that support the CLI
 */
export const GT_LIBRARIES = [
  Libraries.GT_REACT,
  Libraries.GT_NEXT,
  Libraries.GT_REACT_NATIVE,
  Libraries.GT_NODE,
  Libraries.GT_I18N,
  Libraries.GT_REACT_CORE,
] as const;
export type GTLibrary = (typeof GT_LIBRARIES)[number];

/**
 * Libraries that support inline translation
 */
export const INLINE_LIBRARIES = [
  Libraries.GT_REACT,
  Libraries.GT_NEXT,
  Libraries.GT_NODE,
  Libraries.GT_REACT_NATIVE,
  Libraries.GT_REACT_CORE,
  Libraries.GT_I18N,
] as const;
export type InlineLibrary = (typeof INLINE_LIBRARIES)[number];

export function isInlineLibrary(lib: string): lib is InlineLibrary {
  return (INLINE_LIBRARIES as readonly string[]).includes(lib);
}

/**
 * Libraries that support react primitives
 */
export const REACT_LIBRARIES = [
  Libraries.GT_NEXT,
  Libraries.GT_REACT,
  Libraries.GT_REACT_NATIVE,
  Libraries.GT_REACT_CORE,
] as const;
export type ReactLibrary = (typeof REACT_LIBRARIES)[number];

/**
 * A mapping of each library to their upstream dependencies for filtering imports
 */
export const GT_LIBRARIES_UPSTREAM: Record<GTLibrary, GTLibrary[]> = {
  [Libraries.GT_NEXT]: [
    Libraries.GT_I18N,
    Libraries.GT_REACT_CORE,
    Libraries.GT_REACT,
    Libraries.GT_NEXT,
  ],
  [Libraries.GT_REACT]: [
    Libraries.GT_I18N,
    Libraries.GT_REACT_CORE,
    Libraries.GT_REACT,
    Libraries.GT_REACT_NATIVE, // allow for cross-library compatibility (gt-react/gt-react-native only)
  ],
  [Libraries.GT_REACT_NATIVE]: [
    Libraries.GT_I18N,
    Libraries.GT_REACT_CORE,
    Libraries.GT_REACT_NATIVE,
    Libraries.GT_REACT, // allow for cross-library compatibility (gt-react/gt-react-native only)
  ],
  [Libraries.GT_NODE]: [Libraries.GT_I18N, Libraries.GT_NODE],
  [Libraries.GT_REACT_CORE]: [Libraries.GT_I18N, Libraries.GT_REACT_CORE],
  [Libraries.GT_I18N]: [Libraries.GT_I18N],
} as const;
