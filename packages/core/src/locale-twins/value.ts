import type { Content } from '@generaltranslation/format/types';

/**
 * A filled locale twin placeholder: one call site's content in one locale,
 * and the locale whose rules format it. The locale is the source locale when
 * the twin's locale has no translation for the entry (the content is then
 * the source text), like a missing translation without locale twins.
 */
export type LocaleTwinValue = [locale: string, content: Content];

// Pure: unused in apps without locale twins, so bundlers can drop them
const LINE_SEPARATOR = /* @__PURE__ */ String.fromCharCode(0x2028);
const PARAGRAPH_SEPARATOR = /* @__PURE__ */ String.fromCharCode(0x2029);

/**
 * Serializes a filled placeholder into the JS source that replaces the whole
 * placeholder literal (quotes included): the JSON of `[locale, content]`,
 * with U+2028/U+2029 escaped so it is a valid expression in every JS parser.
 * The runtime reads it as is, without parsing.
 */
export function serializeLocaleTwinValue(
  locale: string,
  content: Content
): string {
  const value: LocaleTwinValue = [locale, content];
  return JSON.stringify(value)
    .split(LINE_SEPARATOR)
    .join('\\u2028')
    .split(PARAGRAPH_SEPARATOR)
    .join('\\u2029');
}
