import type { Content } from '@generaltranslation/format/types';
import { decodeBase64Url, encodeBase64Url } from './base64url';
import { LOCALE_TWIN_PLACEHOLDER_PREFIX } from './constants';
import { createLocaleTwinDiagnostic } from './diagnostics';

/** Source-locale (or translated) content keyed by 16-hex entry hash. */
export type LocaleTwinEntries = Record<string, Content>;

/** A string-literal token in code whose content is an unfilled placeholder. */
export type LocaleTwinPlaceholderMatch = {
  /** Offset of the opening quote. */
  start: number;
  /** Offset just past the closing quote. */
  end: number;
  /** The whole literal token, quotes included (`code.slice(start, end)`). */
  token: string;
  /** The quote character used by the token. */
  quote: "'" | '"' | '`';
  /** The placeholder string (the token without its quotes). */
  placeholder: string;
  /** Entry hashes named by the placeholder, sorted. */
  hashes: string[];
  /** Source-locale content carried by the placeholder, keyed by hash. */
  entries: LocaleTwinEntries;
};

const HASH_SOURCE = '[0-9a-f]{16}';
const HASH_PATTERN = new RegExp(`^${HASH_SOURCE}$`);
const PLACEHOLDER_SOURCE = `${LOCALE_TWIN_PLACEHOLDER_PREFIX}:(?:${HASH_SOURCE}(?:,${HASH_SOURCE})*):[A-Za-z0-9_-]+`;
const PLACEHOLDER_PATTERN = new RegExp(
  `^${LOCALE_TWIN_PLACEHOLDER_PREFIX}:(${HASH_SOURCE}(?:,${HASH_SOURCE})*):([A-Za-z0-9_-]+)$`
);
const PLACEHOLDER_TOKEN_PATTERN = new RegExp(
  `(['"\`])(${PLACEHOLDER_SOURCE})\\1`,
  'g'
);

/**
 * Encodes a module's entries as an unfilled locale twin placeholder:
 * `__GT_LOCALE_TWIN__:<h1>,<h2>,...:<payload>`, where the hashes are sorted and
 * the payload is unpadded base64url of the JSON array of sources aligned with
 * the hashes. The charset is safe inside any JS quote style.
 */
export function encodeLocaleTwinPlaceholder(
  entries: LocaleTwinEntries
): string {
  const hashes = Object.keys(entries).sort();
  if (hashes.length === 0) {
    throw new Error(
      createLocaleTwinDiagnostic({
        severity: 'Error',
        whatHappened: 'A locale twin placeholder could not be created',
        why: 'it must name at least one entry hash',
      })
    );
  }
  const invalidHashes = hashes.filter((hash) => !HASH_PATTERN.test(hash));
  if (invalidHashes.length > 0) {
    throw new Error(
      createLocaleTwinDiagnostic({
        severity: 'Error',
        whatHappened: 'A locale twin placeholder could not be created',
        why: 'entry hashes must be 16 lowercase hexadecimal characters',
        details: invalidHashes,
      })
    );
  }
  const payload = encodeBase64Url(
    JSON.stringify(hashes.map((hash) => entries[hash]))
  );
  return `${LOCALE_TWIN_PLACEHOLDER_PREFIX}:${hashes.join(',')}:${payload}`;
}

/**
 * Decodes an unfilled locale twin placeholder into its entries. Returns
 * `undefined` when the value is not a well-formed placeholder (including the
 * bare prefix, unsorted or duplicate hashes, and payloads whose length does not
 * match the hashes).
 */
export function decodeLocaleTwinPlaceholder(
  value: string
): LocaleTwinEntries | undefined {
  return decodePlaceholderParts(value)?.entries;
}

/** Whether `value` is a well-formed, unfilled locale twin placeholder. */
export function isUnfilledLocaleTwinPlaceholder(
  value: unknown
): value is string {
  return (
    typeof value === 'string' &&
    decodeLocaleTwinPlaceholder(value) !== undefined
  );
}

/**
 * Finds every string-literal token (`'`, `"`, or backtick, quotes included)
 * in `code` whose content is a well-formed placeholder. Escaped quotes do not
 * open a token, so placeholders nested inside another string are ignored.
 */
export function findLocaleTwinPlaceholders(
  code: string
): LocaleTwinPlaceholderMatch[] {
  const matches: LocaleTwinPlaceholderMatch[] = [];
  const pattern = new RegExp(PLACEHOLDER_TOKEN_PATTERN);
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(code)) !== null) {
    const start = match.index;
    const decoded = isEscaped(code, start)
      ? undefined
      : decodePlaceholderParts(match[2]);
    if (!decoded) {
      pattern.lastIndex = start + 1;
      continue;
    }
    matches.push({
      start,
      end: start + match[0].length,
      token: match[0],
      quote: match[1] as LocaleTwinPlaceholderMatch['quote'],
      placeholder: match[2],
      hashes: decoded.hashes,
      entries: decoded.entries,
    });
  }
  return matches;
}

function decodePlaceholderParts(
  value: string
): { hashes: string[]; entries: LocaleTwinEntries } | undefined {
  const match = PLACEHOLDER_PATTERN.exec(value);
  if (!match) return undefined;
  const hashes = match[1].split(',');
  for (let i = 1; i < hashes.length; i++) {
    if (hashes[i - 1] >= hashes[i]) return undefined;
  }
  const json = decodeBase64Url(match[2]);
  if (json === undefined) return undefined;
  let sources: unknown;
  try {
    sources = JSON.parse(json);
  } catch {
    return undefined;
  }
  if (!Array.isArray(sources) || sources.length !== hashes.length) {
    return undefined;
  }
  const entries: LocaleTwinEntries = {};
  hashes.forEach((hash, index) => {
    entries[hash] = sources[index] as Content;
  });
  return { hashes, entries };
}

/** Whether the character at `index` is preceded by an odd number of backslashes. */
function isEscaped(code: string, index: number): boolean {
  let backslashes = 0;
  for (let i = index - 1; i >= 0 && code[i] === '\\'; i--) backslashes++;
  return backslashes % 2 === 1;
}
