/**
 * Experimental tagged-template entry points. Build tools (the CLI extractor
 * and the compiler) treat their `t`/`useGT`/`getGT` messages as ICU syntax
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
  '@generaltranslation/react-core/unstable-rsc',
] as const;

export function isUnstableGTImportSource(source: string): boolean {
  return (UNSTABLE_GT_IMPORT_SOURCES as readonly string[]).includes(source);
}
