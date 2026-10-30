import type { Content } from '@generaltranslation/format/types';
import { decodeBase64Url, encodeBase64Url } from './base64url';
import { LOCALE_TWIN_PLACEHOLDER_PREFIX } from './constants';
import { createLocaleTwinDiagnostic } from './diagnostics';

/** Source-locale (or translated) content keyed by 16-hex entry hash. */
export type LocaleTwinEntries = Record<string, Content>;

/** The entry an unfilled placeholder stands for. */
export type LocaleTwinPlaceholderEntry = {
  /** The entry hash (16 lowercase hex), as in `[locale].json`. */
  hash: string;
  /** The entry's source-locale content. */
  source: Content;
};

/** A string-literal token in code whose content is an unfilled placeholder. */
export type LocaleTwinPlaceholderMatch = LocaleTwinPlaceholderEntry & {
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
};

const HASH_SOURCE = '[0-9a-f]{16}';
const HASH_PATTERN = /^[0-9a-f]{16}$/;

// The placeholder patterns are built on first use: module-level template
// strings and RegExp calls would survive tree-shaking in apps without twins.
let placeholderPattern: RegExp | undefined;

function getPlaceholderPattern(): RegExp {
  placeholderPattern ??= new RegExp(
    `^${LOCALE_TWIN_PLACEHOLDER_PREFIX}:(${HASH_SOURCE}):([A-Za-z0-9_-]+)$`
  );
  return placeholderPattern;
}

/** A fresh global pattern for placeholder string-literal tokens. */
function createPlaceholderTokenPattern(): RegExp {
  const placeholderSource = `${LOCALE_TWIN_PLACEHOLDER_PREFIX}:${HASH_SOURCE}:[A-Za-z0-9_-]+`;
  return new RegExp(`(['"\`])(${placeholderSource})\\1`, 'g');
}

/**
 * Encodes one call site's entry as an unfilled locale twin placeholder:
 * `__GT_LOCALE_TWIN__:<hash>:<payload>`, where the payload is unpadded
 * base64url of the source content's JSON. The charset is safe inside any JS
 * quote style, so the literal survives minifiers that change quotes.
 */
export function encodeLocaleTwinPlaceholder(
  hash: string,
  source: Content
): string {
  if (!HASH_PATTERN.test(hash)) {
    throw new Error(
      createLocaleTwinDiagnostic({
        severity: 'Error',
        whatHappened: 'A locale twin placeholder could not be created',
        why: 'entry hashes must be 16 lowercase hexadecimal characters',
        details: hash,
      })
    );
  }
  const payload = encodeBase64Url(JSON.stringify(source));
  return `${LOCALE_TWIN_PLACEHOLDER_PREFIX}:${hash}:${payload}`;
}

/**
 * Decodes an unfilled locale twin placeholder into its entry. Returns
 * `undefined` when the value is not a well-formed placeholder (including the
 * bare prefix, which names no hash).
 */
export function decodeLocaleTwinPlaceholder(
  value: string
): LocaleTwinPlaceholderEntry | undefined {
  const match = getPlaceholderPattern().exec(value);
  if (!match) return undefined;
  const json = decodeBase64Url(match[2]);
  if (json === undefined) return undefined;
  try {
    return { hash: match[1], source: JSON.parse(json) as Content };
  } catch {
    return undefined;
  }
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
  const pattern = createPlaceholderTokenPattern();
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(code)) !== null) {
    const start = match.index;
    const decoded = isEscaped(code, start)
      ? undefined
      : decodeLocaleTwinPlaceholder(match[2]);
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
      ...decoded,
    });
  }
  return matches;
}

/** Whether the character at `index` is preceded by an odd number of backslashes. */
function isEscaped(code: string, index: number): boolean {
  let backslashes = 0;
  for (let i = index - 1; i >= 0 && code[i] === '\\'; i--) backslashes++;
  return backslashes % 2 === 1;
}
