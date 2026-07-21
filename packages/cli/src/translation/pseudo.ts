import {
  TYPE,
  type LiteralElement,
  type MessageFormatElement,
} from '@formatjs/icu-messageformat-parser';
import { isValidLocale } from '@generaltranslation/format';
import {
  HTML_CONTENT_PROPS,
  type CustomMapping,
  type GTProp,
  type JsxChild,
  type JsxChildren,
  type JsxElement,
} from '@generaltranslation/format/types';
import {
  isVariable,
  printIcuAst,
  traverseIcu,
} from 'generaltranslation/internal';
import type { Updates } from 'generaltranslation/types';
import type { Translations } from '../types/data.js';

export const PSEUDO_DEFAULT_LOCALE = 'en-XA';

// ~40% growth approximates the worst-case expansion of real translations
// (German, Finnish), so layouts that survive pseudo survive production.
const EXPANSION_RATIO = 0.4;

const ACCENT_MAP: Record<string, string> = {
  a: 'à',
  b: 'ƀ',
  c: 'ç',
  d: 'đ',
  e: 'é',
  f: 'ƒ',
  g: 'ğ',
  h: 'ĥ',
  i: 'î',
  j: 'ĵ',
  k: 'ķ',
  l: 'ļ',
  m: 'ɱ',
  n: 'ñ',
  o: 'ö',
  p: 'ƥ',
  q: 'ǫ',
  r: 'ŕ',
  s: 'š',
  t: 'ţ',
  u: 'û',
  v: 'ṽ',
  w: 'ŵ',
  x: 'ẋ',
  y: 'ý',
  z: 'ž',
  A: 'À',
  B: 'Ɓ',
  C: 'Ç',
  D: 'Đ',
  E: 'É',
  F: 'Ƒ',
  G: 'Ğ',
  H: 'Ĥ',
  I: 'Î',
  J: 'Ĵ',
  K: 'Ķ',
  L: 'Ļ',
  M: 'Ṁ',
  N: 'Ñ',
  O: 'Ö',
  P: 'Ƥ',
  Q: 'Ǫ',
  R: 'Ŕ',
  S: 'Š',
  T: 'Ţ',
  U: 'Û',
  V: 'Ṽ',
  W: 'Ŵ',
  X: 'Ẋ',
  Y: 'Ý',
  Z: 'Ž',
};

// Matches i18next {{interpolations}} and $t(nesting) references. The $t
// alternative stops at the first ')', matching i18next's own non-greedy
// nesting regexp (/\$t\((.+?)\)/), so keys cannot contain ')' either way.
const I18NEXT_TOKENS = /(\{\{[^}]*\}\}|\$t\([^)]*\))/g;

function accentText(text: string): { text: string; letters: number } {
  let letters = 0;
  const accented = text.replace(/[a-zA-Z]/g, (char) => {
    letters++;
    return ACCENT_MAP[char];
  });
  return { text: accented, letters };
}

function expansionPadding(letters: number): string {
  if (letters <= 0) return '';
  return ` ${'~'.repeat(Math.ceil(letters * EXPANSION_RATIO))}`;
}

function pseudoLocalizeIcu(message: string): string {
  let letters = 0;
  let ast: MessageFormatElement[];
  try {
    ast = traverseIcu({
      icuString: message,
      shouldVisit: (element): element is LiteralElement =>
        element.type === TYPE.literal,
      visitor: (element) => {
        const result = accentText(element.value);
        element.value = result.text;
        letters += result.letters;
      },
      options: {},
    });
  } catch {
    // Not valid ICU; accent the raw text so the string is still visibly pseudo
    return pseudoLocalizePlain(message);
  }
  // escapeAllPounds keeps literal '#' in plural options escaped on reprint;
  // pseudo output never feeds hashing, so byte-identity does not apply here
  return `[${printIcuAst(ast, { escapeAllPounds: true })}${expansionPadding(letters)}]`;
}

function pseudoLocalizeI18next(message: string): string {
  let letters = 0;
  const transformed = message
    .split(I18NEXT_TOKENS)
    .map((part, index) => {
      // Odd indexes are the captured tokens; leave them intact
      if (index % 2 === 1) return part;
      const result = accentText(part);
      letters += result.letters;
      return result.text;
    })
    .join('');
  return `[${transformed}${expansionPadding(letters)}]`;
}

function pseudoLocalizePlain(message: string): string {
  const result = accentText(message);
  return `[${result.text}${expansionPadding(result.letters)}]`;
}

/**
 * Pseudo-localizes a string message. ICU messages keep their arguments,
 * plural/select structure, and tags intact; only literal text is transformed.
 */
export function pseudoLocalizeMessage(
  message: string,
  dataFormat: 'ICU' | 'I18NEXT' | 'STRING'
): string {
  switch (dataFormat) {
    case 'ICU':
      return pseudoLocalizeIcu(message);
    case 'I18NEXT':
      return pseudoLocalizeI18next(message);
    default:
      return pseudoLocalizePlain(message);
  }
}

function walkJsxChildren(
  children: JsxChildren,
  counter: { letters: number }
): JsxChildren {
  if (Array.isArray(children)) {
    return children.map((child) => walkJsxChild(child, counter));
  }
  return walkJsxChild(children, counter);
}

function walkJsxChild(child: JsxChild, counter: { letters: number }): JsxChild {
  if (typeof child === 'string') {
    const result = accentText(child);
    counter.letters += result.letters;
    return result.text;
  }
  if (isVariable(child)) return child;
  if (child && typeof child === 'object') {
    return walkJsxElement(child, counter);
  }
  return child;
}

function walkJsxElement(
  element: JsxElement,
  counter: { letters: number }
): JsxElement {
  const walked: JsxElement = { ...element };
  if (walked.c !== undefined) {
    walked.c = walkJsxChildren(walked.c, counter);
  }
  if (walked.d) {
    const data: GTProp = { ...walked.d };
    if (data.b) {
      data.b = Object.fromEntries(
        Object.entries(data.b).map(([branch, value]) => [
          branch,
          walkJsxChildren(value, counter),
        ])
      );
    }
    for (const key of Object.keys(HTML_CONTENT_PROPS) as Array<
      keyof typeof HTML_CONTENT_PROPS
    >) {
      // arb/ard (aria-labelledby/aria-describedby) hold element ids, not text
      if (key === 'arb' || key === 'ard') continue;
      const value = data[key];
      if (typeof value === 'string') {
        const result = accentText(value);
        counter.letters += result.letters;
        data[key] = result.text;
      }
    }
    walked.d = data;
  }
  return walked;
}

/**
 * Pseudo-localizes JSX content. Text nodes and translatable content props
 * (placeholder, title, alt, aria-*) are transformed; variable nodes, tags,
 * ids, and branch markers pass through untouched. The top level is wrapped
 * in [brackets] with trailing expansion padding.
 */
export function pseudoLocalizeJsx(children: JsxChildren): JsxChildren {
  const counter = { letters: 0 };
  const walked = walkJsxChildren(children, counter);
  const walkedArray = Array.isArray(walked) ? walked : [walked];
  return ['[', ...walkedArray, `${expansionPadding(counter.letters)}]`];
}

/**
 * Builds a hash -> pseudo-localized content map from aggregated updates,
 * in the same shape `gt generate` writes for real locales.
 */
export function buildPseudoTranslations(updates: Updates): Translations {
  const translations: Translations = {};
  for (const update of updates) {
    const { hash } = update.metadata;
    if (!hash) continue;
    translations[hash] =
      update.dataFormat === 'JSX'
        ? pseudoLocalizeJsx(update.source)
        : pseudoLocalizeMessage(update.source, update.dataFormat);
  }
  return translations;
}

/**
 * Whether a locale carries one of the CLDR pseudo regions (en-XA, ar-XB).
 * Pseudo-region translation files are machine-generated, never hand-managed.
 */
export function isPseudoLocale(locale: string): boolean {
  try {
    const { region } = new Intl.Locale(locale);
    return region === 'XA' || region === 'XB';
  } catch {
    return false;
  }
}

/**
 * Resolves the --pseudo flag to a locale, defaulting to en-XA
 * (CLDR "Pseudo-Accents"). Throws if the locale is invalid or if writing
 * its file would destroy real translations (the default locale's source
 * file, or a configured locale that is not a pseudo-locale).
 */
export function resolvePseudoLocale(
  flag: boolean | string,
  defaultLocale: string,
  locales: string[],
  customMapping?: CustomMapping
): string {
  const locale = typeof flag === 'string' ? flag : PSEUDO_DEFAULT_LOCALE;
  if (!isValidLocale(locale, customMapping)) {
    throw new Error(`Invalid pseudo-locale: ${locale}`);
  }
  if (locale === defaultLocale) {
    throw new Error(
      `The pseudo-locale cannot be the default locale (${defaultLocale}); it would overwrite the source translation file.`
    );
  }
  if (locales.includes(locale) && !isPseudoLocale(locale)) {
    throw new Error(
      `'${locale}' is a configured locale; generating pseudo content for it would overwrite its translations. Use a pseudo-locale like ${PSEUDO_DEFAULT_LOCALE} instead.`
    );
  }
  return locale;
}
