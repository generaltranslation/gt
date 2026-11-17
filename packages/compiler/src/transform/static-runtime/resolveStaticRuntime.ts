import type { MessageTree } from '@generaltranslation/icu';
import { forEachPlaceholder } from '@generaltranslation/icu/internal';
import { resolveCanonicalLocale } from '@generaltranslation/format';
import { defaultDefaultLocale } from '@generaltranslation/format/internal';
import { createDiagnosticMessage } from 'generaltranslation/diagnostics';
import type { GTConfig } from '../../config';
import {
  REPLACE_SOURCE_ENV_VAR,
  type SourceReplacement,
} from '../injection/inline-translations/resolveSourceReplacement';
import { STATIC_LOCALE_ENV_VAR } from '../injection/inline-translations/resolveStaticLocale';

/**
 * Environment variable read when the `experimentalStaticRuntime` option is
 * not set, so a build script can turn it on next to `GT_STATIC_LOCALE`.
 */
export const STATIC_RUNTIME_ENV_VAR = 'GT_STATIC_RUNTIME';

/** The entry compiled code imports instead of gt-react. */
export const STATIC_RUNTIME_SOURCE = 'gt-react/static-runtime';

/**
 * What a call site formats with: `value` for each value of a message of text
 * and values, which is a template literal; `tree` for the message tree of a
 * message with selects and plurals; and `intl` for the tree of one that also
 * formats a number, a date or a time, which needs the runtime's own formatter.
 */
export const STATIC_HELPERS = {
  value: { name: 'staticValue', source: STATIC_RUNTIME_SOURCE },
  tree: { name: 'formatStatic', source: STATIC_RUNTIME_SOURCE },
  intl: { name: 'formatStaticIntl', source: `${STATIC_RUNTIME_SOURCE}/intl` },
} as const;

export type StaticHelperKind = keyof typeof STATIC_HELPERS;

const ENV_TRUE_VALUES = new Set(['true', '1']);
const ENV_FALSE_VALUES = new Set(['false', '0', '']);

/**
 * What a static-runtime build formats its messages with: the build's locale
 * and then its default locale, as Intl reads them, and the configured time
 * zone, if any.
 */
export type StaticRuntime = {
  locales: string[];
  timeZone?: string;
  /**
   * What the build's Intl says about each integer from 0 up to 1,000 in
   * these locales, so the static formatter can format a plural of such a
   * count without building an Intl object.
   */
  counts: StaticCounts;
};

export type StaticCounts = {
  /** Whether Intl formats each as its digits */
  digits: boolean;
  /** The plural categories of each, encoded, or undefined when they do not encode compactly */
  plural?: string;
  /** The same for ordinals */
  selectordinal?: string;
};

// The range the static formatter is told about, SMALL_COUNT_LIMIT in gt-react's static-runtime.ts
const SMALL_COUNT_LIMIT = 1000;

// A table longer than this costs more bytes than the Intl.PluralRules it saves is worth
const MAX_PLURAL_TABLE_LENGTH = 250;

// One letter per plural category, PLURAL_CATEGORIES in gt-react's static-runtime.ts
const CATEGORY_LETTERS: Record<Intl.LDMLPluralRule, string> = {
  zero: 'z',
  one: 'o',
  two: 't',
  few: 'f',
  many: 'm',
  other: 'x',
};

/**
 * The plural categories Intl gives each integer from 0 up to 1,000 in
 * `locales`, one letter each: those of the first integers, then after a `|`
 * the ones that repeat from there on, which is how every language's rules
 * read on integers. Undefined when that is not compact. Asked of the build's
 * Intl with the arguments the static formatter passes, and assumed to agree
 * with the browser's.
 */
export function encodePluralCategories(
  locales: string[],
  type: Intl.PluralRuleType
): string | undefined {
  const rules = new Intl.PluralRules(locales, { type });
  const letters = Array.from(
    { length: SMALL_COUNT_LIMIT },
    (_, integer) => CATEGORY_LETTERS[rules.select(integer)]
  ).join('');
  let best: string | undefined;
  for (let period = 1; period <= MAX_PLURAL_TABLE_LENGTH; period++) {
    // The integers before the first one from which every category repeats
    let first = 0;
    for (let index = SMALL_COUNT_LIMIT - 1; index >= period; index--) {
      if (letters[index] !== letters[index - period]) {
        first = index - period + 1;
        break;
      }
    }
    const table = `${letters.slice(0, first)}|${letters.slice(first, first + period)}`;
    if (
      first + period < SMALL_COUNT_LIMIT &&
      (best === undefined || table.length < best.length)
    ) {
      best = table;
    }
  }
  return best !== undefined && best.length <= MAX_PLURAL_TABLE_LENGTH
    ? best
    : undefined;
}

/**
 * What the static formatter is told about small counts to format one tree,
 * as its `digits`, `plural` and `selectordinal` arguments: only what the
 * tree's plurals read, and nothing in place of the rest.
 */
export function getStaticCountArguments(
  counts: StaticCounts,
  tree: MessageTree
): [digits: 0 | 1, plural: string, selectordinal: string] {
  let counted = false;
  const kinds = new Set<string>();
  forEachPlaceholder(tree, (node) => {
    if (node[1] !== 'plural' && node[1] !== 'selectordinal') return;
    counted = true;
    // Only a branch named for a category has one selected
    if (Object.keys(node[2]).some((key) => key !== 'other' && key[0] !== '=')) {
      kinds.add(node[1]);
    }
  });
  return [
    counted && counts.digits ? 1 : 0,
    (kinds.has('plural') && counts.plural) || '',
    (kinds.has('selectordinal') && counts.selectordinal) || '',
  ];
}

/**
 * Whether the formatter of a plural's count in `locales`, an
 * `Intl.NumberFormat` without options, formats every integer from 0 up to
 * 1,000 as `String` does: no other digits, as in Arabic or Bengali, and no
 * grouping. Asked of the build's Intl, which is assumed to agree with the
 * browser's on these digits.
 */
export function formatsPlainIntegers(locales: string[]): boolean {
  const format = new Intl.NumberFormat(locales);
  for (let integer = 0; integer < SMALL_COUNT_LIMIT; integer++) {
    if (format.format(integer) !== String(integer)) return false;
  }
  return true;
}

const createInvalidStaticRuntimeEnvError = (value: string) =>
  createDiagnosticMessage({
    source: '@generaltranslation/compiler',
    severity: 'Error',
    whatHappened: `${STATIC_RUNTIME_ENV_VAR} is set to "${value}", which is not a boolean`,
    fix: `Set ${STATIC_RUNTIME_ENV_VAR} to true or false`,
  });

export const STATIC_RUNTIME_WITHOUT_SOURCE_REPLACEMENT_ERROR =
  createDiagnosticMessage({
    source: '@generaltranslation/compiler',
    severity: 'Error',
    whatHappened:
      'experimentalStaticRuntime is set, but this build does not replace source content for a static locale',
    why: 'a static-runtime build resolves every translation at build time, for one locale whose translations the build can read',
    fix: `Set experimentalStaticLocale (or ${STATIC_LOCALE_ENV_VAR}) to the source locale or to a locale in files.gt.inlineTranslations.locales, set experimentalReplaceSource (or ${REPLACE_SOURCE_ENV_VAR}), and leave _tagIds and compileTimeHash: false off`,
  });

/**
 * Whether this build leaves the GT runtime out: the
 * `experimentalStaticRuntime` option, else the `GT_STATIC_RUNTIME`
 * environment variable.
 */
export function getStaticRuntime(option: boolean | undefined): boolean {
  if (option !== undefined) return option;
  const raw = process.env[STATIC_RUNTIME_ENV_VAR];
  if (raw === undefined) return false;
  const value = raw.trim().toLowerCase();
  if (ENV_TRUE_VALUES.has(value)) return true;
  if (ENV_FALSE_VALUES.has(value)) return false;
  throw new Error(createInvalidStaticRuntimeEnvError(raw));
}

/**
 * Adds the setting to webpack's and rspack's persistent cache version, which
 * would otherwise reuse modules compiled against the GT runtime.
 */
export function addStaticRuntimeCacheVersion(options: {
  cache?: unknown;
  experiments?: { cache?: unknown };
}): void {
  for (const cache of [options.cache, options.experiments?.cache]) {
    if (cache == null || typeof cache !== 'object' || !('type' in cache)) {
      continue;
    }
    if (cache.type !== 'filesystem' && cache.type !== 'persistent') continue;
    const versioned = cache as { version?: string };
    versioned.version = `${versioned.version ?? ''}|gt-static-runtime`;
  }
}

/**
 * The static runtime of a build, or undefined when the build cannot have one:
 * it needs a source replacement that also replaces `<T>`.
 */
export function resolveStaticRuntime(
  staticRuntime: boolean,
  sourceReplacement: SourceReplacement | undefined,
  gtConfig: GTConfig | undefined
): StaticRuntime | undefined {
  if (!staticRuntime || !sourceReplacement?.jsx) return undefined;
  const defaultLocale = gtConfig?.defaultLocale ?? defaultDefaultLocale;
  // As the runtime resolves the locales it formats in
  const locales = Array.from(
    new Set(
      [sourceReplacement.locale ?? defaultLocale, defaultLocale].map((locale) =>
        resolveCanonicalLocale(locale, gtConfig?.customMapping)
      )
    )
  );
  return {
    locales,
    counts: {
      digits: formatsPlainIntegers(locales),
      plural: encodePluralCategories(locales, 'cardinal'),
      selectordinal: encodePluralCategories(locales, 'ordinal'),
    },
    ...(gtConfig?.timeZone !== undefined && { timeZone: gtConfig.timeZone }),
  };
}
