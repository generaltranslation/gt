/**
 * Entry points that export the message helpers. Build tools (the CLI extractor
 * and the compiler) read a helper imported from one as a message tree.
 */
const GT_MESSAGE_IMPORT_SOURCES = [
  'gt-i18n',
  'gt-react',
  'gt-react-native',
  'gt-next',
  'gt-next/server',
  'gt-tanstack-start',
  'gt-node',
  '@generaltranslation/react-core/pure',
  '@generaltranslation/react-core/hooks',
] as const;

export function isGTMessageImportSource(source: string): boolean {
  return (GT_MESSAGE_IMPORT_SOURCES as readonly string[]).includes(source);
}

/**
 * Exports of those entries that build tools recognize by their imported name.
 * Not every entry exports every name: `t` is SPA-only, and frameworks provide
 * `useGT` or `getGT`.
 */
export const GT_MESSAGE_HELPER_NAMES = [
  't',
  'msg',
  'useGT',
  'getGT',
  'plural',
  'selectordinal',
  'select',
  'number',
  'date',
  'time',
  'part',
  'derive',
  'n',
] as const;

export type GTMessageHelperName = (typeof GT_MESSAGE_HELPER_NAMES)[number];

export function isGTMessageHelperName(
  name: string
): name is GTMessageHelperName {
  return (GT_MESSAGE_HELPER_NAMES as readonly string[]).includes(name);
}
