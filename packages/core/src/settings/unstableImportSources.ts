/**
 * Experimental tagged-template entry points. Build tools (the CLI extractor
 * and the compiler) treat their `t`/`useGT`/`getGT` messages as message
 * trees, never as legacy string or JSX messages.
 */
const UNSTABLE_GT_IMPORT_SOURCES = [
  'gt-i18n/unstable',
  'gt-react/unstable',
  'gt-next/unstable',
  'gt-next/unstable/server',
  'gt-tanstack-start/unstable',
  'gt-react-native/unstable',
  'gt-node/unstable',
  '@generaltranslation/react-core/unstable',
] as const;

export function isUnstableGTImportSource(source: string): boolean {
  return (UNSTABLE_GT_IMPORT_SOURCES as readonly string[]).includes(source);
}

/**
 * Exports of those entries that build tools recognize by their imported name.
 * Not every entry exports every name: `t` is SPA-only, and frameworks provide
 * `useGT` or `getGT`.
 */
export const UNSTABLE_GT_HELPER_NAMES = [
  't',
  'useGT',
  'getGT',
  'plural',
  'selectordinal',
  'select',
  'number',
  'date',
  'part',
  'derive',
  'n',
] as const;

export type UnstableGTHelperName = (typeof UNSTABLE_GT_HELPER_NAMES)[number];

export function isUnstableGTHelperName(
  name: string
): name is UnstableGTHelperName {
  return (UNSTABLE_GT_HELPER_NAMES as readonly string[]).includes(name);
}
