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
  GT_TANSTACK_START = 'gt-tanstack-start',
  GT_VUE = 'gt-vue',
  GT_SVELTE = 'gt-svelte',
  GT_FLASK = 'gt-flask',
  GT_FASTAPI = 'gt-fastapi',
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
  Libraries.GT_TANSTACK_START,
  Libraries.GT_SVELTE,
  Libraries.GT_FLASK,
  Libraries.GT_FASTAPI,
] as const;
export type GTLibrary = (typeof GT_LIBRARIES)[number];

/**
 * Experimental tagged-template entry points. Their `t`/`useGT`/`getGT`
 * messages are extracted as ICU syntax trees, never by the legacy string and
 * JSX extractors.
 */
export const UNSTABLE_GT_IMPORT_SOURCES = [
  'gt-i18n/unstable',
  'gt-react/unstable',
  'gt-next/unstable',
  'gt-next/unstable/server',
  'gt-tanstack-start/unstable',
  'gt-react-native/unstable',
  'gt-node/unstable',
  '@generaltranslation/react-core/unstable',
  '@generaltranslation/react-core/unstable-rsc',
] as const;

export function isUnstableGTImportSource(source: string): boolean {
  return (UNSTABLE_GT_IMPORT_SOURCES as readonly string[]).includes(source);
}

/**
 * Whether an import source belongs to one of `pkgs` for the legacy
 * extractors (prefix match, so subpaths count), excluding unstable sources.
 */
export function isLegacyGTImportSource(
  source: string,
  pkgs: readonly GTLibrary[]
): boolean {
  return (
    !isUnstableGTImportSource(source) &&
    pkgs.some((pkg) => source.startsWith(pkg))
  );
}

/**
 * Libraries that support inline translation
 */
export const INLINE_LIBRARIES = [
  Libraries.GT_REACT,
  Libraries.GT_NEXT,
  Libraries.GT_NODE,
  Libraries.GT_REACT_NATIVE,
  Libraries.GT_REACT_CORE,
  Libraries.GT_TANSTACK_START,
  Libraries.GT_VUE,
  Libraries.GT_SVELTE,
  Libraries.GT_I18N,
  Libraries.GT_FLASK,
  Libraries.GT_FASTAPI,
] as const;
export type InlineLibrary = (typeof INLINE_LIBRARIES)[number];

export function isInlineLibrary(lib: string): lib is InlineLibrary {
  return (INLINE_LIBRARIES as readonly string[]).includes(lib);
}

/** Returns the framework-specific label for the shared inline GTJSON file. */
export function getInlineElementsLabel(
  inlineLibrary?: InlineLibrary
): 'Vue Elements' | 'Svelte Elements' | 'React Elements' {
  if (inlineLibrary === Libraries.GT_VUE) return 'Vue Elements';
  if (inlineLibrary === Libraries.GT_SVELTE) return 'Svelte Elements';
  return 'React Elements';
}

/**
 * Libraries that support react primitives
 */
export const REACT_LIBRARIES = [
  Libraries.GT_NEXT,
  Libraries.GT_REACT,
  Libraries.GT_REACT_NATIVE,
  Libraries.GT_REACT_CORE,
  Libraries.GT_TANSTACK_START,
] as const;
export type ReactLibrary = (typeof REACT_LIBRARIES)[number];

/**
 * Node/server-side libraries
 */
export const NODE_LIBRARIES = [Libraries.GT_NODE, Libraries.GT_I18N] as const;
export type NodeLibrary = (typeof NODE_LIBRARIES)[number];

/**
 * Python libraries
 */
export const PYTHON_LIBRARIES = [
  Libraries.GT_FLASK,
  Libraries.GT_FASTAPI,
] as const;
export type PythonLibrary = (typeof PYTHON_LIBRARIES)[number];

export function isPythonLibrary(lib: string): lib is PythonLibrary {
  return (PYTHON_LIBRARIES as readonly string[]).includes(lib);
}

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
  [Libraries.GT_TANSTACK_START]: [
    Libraries.GT_I18N,
    Libraries.GT_REACT_CORE,
    Libraries.GT_REACT,
    Libraries.GT_TANSTACK_START,
  ],
  [Libraries.GT_SVELTE]: [Libraries.GT_I18N, Libraries.GT_SVELTE],
  [Libraries.GT_I18N]: [Libraries.GT_I18N],
  [Libraries.GT_FLASK]: [Libraries.GT_FLASK],
  [Libraries.GT_FASTAPI]: [Libraries.GT_FASTAPI],
} as const;
