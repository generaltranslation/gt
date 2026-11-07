import { parse } from '../parser/parse';
import { printAST } from '../parser/printer';
import {
  createConflictingSourceFormatsError,
  createTranslationMismatchError,
} from '../errors/convertErrors';
import { isPluralCategoryKey } from '../settings/syntax';
import { normalizeTree } from '../tree/canonical';
import type {
  DateTimeNode,
  MessageTree,
  NumberNode,
  PluralNode,
} from '../tree/messageTree';
import { collectVariables, formatKey, variableKey } from '../tree/variables';
import {
  forEachPlaceholder,
  isBranchingNode,
  isFormattedNode,
  mapPlaceholders,
} from '../tree/walk';
import { fromMessageTree, toMessageTree } from './syntaxTree';

export type IcuToMessageTreeOptions = {
  /**
   * The tree this ICU string was printed from with `messageTreeToIcu`, such
   * as the source of a translation. Its formats replace the string's, which
   * restores Intl options ICU cannot spell, and the string must use the same
   * variables.
   */
  source?: MessageTree;
  /**
   * The locale of the string, when it translates `source`. Plural
   * categories the locale does not have, like `one` in Japanese, may be left
   * out, together with the variables only they use.
   */
  locale?: string;
};

/**
 * Converts an ICU MessageFormat string to a canonical message tree, sorted
 * like `buildMessageTree` output so it hashes the same way:
 *
 *   icuToMessageTree('{n, plural, one {# file} other {# files}}')
 *   // [['n', 'plural', { one: [0, ' file'], other: [0, ' files'] }]]
 *
 * When the string is a translation of a tree printed with `messageTreeToIcu`,
 * pass that tree as `source` to restore the formats printing dropped:
 *
 *   const source = ['Due ', ['due', 'date', { dateStyle: 'medium', timeZone: 'UTC' }]];
 *   messageTreeToIcu(source); // 'Due {due, date}'
 *   icuToMessageTree('Échéance {due, date}', { source });
 *   // ['Échéance ', ['due', 'date', { dateStyle: 'medium', timeZone: 'UTC' }]]
 *
 * Throws a `SyntaxError` for an invalid ICU string, and an `Error` when the
 * string uses a variable the source does not, misses one, or changes its
 * kind or plural offset. With a `locale`, a variable may be missing when the
 * source uses it only in plural categories that locale does not have:
 *
 *   const source = [['n', 'plural', { one: ['Only ', ['name']], other: [0, ' files'] }]];
 *   icuToMessageTree('{n, plural, other {#件}}', { source, locale: 'ja' });
 *   // [['n', 'plural', { other: [0, '件'] }]]
 */
export function icuToMessageTree(
  icu: string,
  { source, locale }: IcuToMessageTreeOptions = {}
): MessageTree {
  const tree = toMessageTree(parse(icu));
  return normalizeTree(source ? restoreFormats(tree, source, locale) : tree);
}

/**
 * Prints a message tree as an ICU MessageFormat string, e.g. for a
 * translator. Intl options print as an ICU skeleton, or the named `percent`
 * style, that `icuToMessageTree` reads back as the same format whatever the
 * locale or time zone, so every ICU string it reads prints back. Skeletons are
 * spelled as the formatjs-compatible parser reads them; a few, such as
 * `unit-width-short`, read differently in ICU4C. Engines also apply their own
 * defaults, as for any `{n, number}`: ICU4C rounds half-even where Intl rounds
 * half away from zero.
 *
 *   messageTreeToIcu([['price', 'number', { currency: 'USD', style: 'currency' }]]);
 *   // '{price, number, ::currency/USD}'
 *
 * Tree-only options with no ICU spelling, such as `timeZone`, `calendar` or
 * `dateStyle`, are left out, and `icuToMessageTree(icu, { source })` restores
 * them. A format whose fields ICU cannot spell, such as
 * `fractionalSecondDigits`, is dropped whole. Named styles are kept.
 */
export function messageTreeToIcu(tree: MessageTree): string {
  // Canonical first: adjacent text must print as one literal, since
  // quoting '{' and '}' separately gives '{''}', an escaped quote.
  return printAST(fromMessageTree(normalizeTree(tree)));
}

/**
 * Returns the name of a variable with two formats that ICU spells the same
 * way, or undefined. A format is the style of a `number`, `date` or `time`
 * placeholder; two formats ICU spells alike differ only in tree-only options
 * such as `timeZone`. Variables are compared by `variableKey`, so `{d, date}`
 * and `{d, time}` are two variables.
 *
 *   [['p', 'number', { style: 'percent' }], ' of ', ['p', 'number']]  // undefined
 *   [['d', 'date', { dateStyle: 'short', timeZone: 'UTC' }],
 *    ['d', 'date', { dateStyle: 'short' }]]                            // 'd'
 *
 * A translation takes each format from the source, by the variable and how
 * the translated placeholder spells it, so such a tree cannot be translated:
 * the CLI skips it, and `icuToMessageTree` rejects it as a source.
 */
export function findConflictingFormat(tree: MessageTree): string | undefined {
  const formats = new Map<string, string>();
  let conflict: string | undefined;
  forEachPlaceholder(tree, (node) => {
    if (conflict !== undefined || !isFormattedNode(node)) return;
    const key = formatSlot(node);
    const format = formatKey(node[2]);
    const first = formats.get(key);
    if (first === undefined) formats.set(key, format);
    else if (first !== format) conflict = node[0];
  });
  return conflict;
}

/** A formatted placeholder's variable and how `messageTreeToIcu` spells it. */
function formatSlot(node: NumberNode | DateTimeNode): string {
  return JSON.stringify([variableKey(node), printAST(fromMessageTree([node]))]);
}

function restoreFormats(
  tree: MessageTree,
  source: MessageTree,
  locale: string | undefined
): MessageTree {
  // Restoring by spelling needs one format per spelling in the source.
  const conflict = findConflictingFormat(source);
  if (conflict !== undefined) {
    throw new Error(createConflictingSourceFormatsError(conflict));
  }

  const sourceVariables = collectVariables(source);
  const translationVariables = collectVariables(tree);
  const sourceNames = new Set(
    [...sourceVariables.values()].map((node) => node[0])
  );
  const problems: string[] = [];
  for (const [key, node] of translationVariables) {
    if (sourceVariables.has(key)) continue;
    problems.push(
      sourceNames.has(node[0])
        ? `"${node[0]}" changed kind or plural offset`
        : `"${node[0]}" does not exist in the source`
    );
  }
  const requiredVariables = locale
    ? collectVariables(withLocaleCategories(source, locale))
    : sourceVariables;
  for (const [key, node] of requiredVariables) {
    if (!translationVariables.has(key)) {
      problems.push(`"${node[0]}" is missing from the translation`);
    }
  }

  // The source decides formats: a translation cannot change a currency or
  // drop the time from a date. A variable with one format keeps it; one with
  // several keeps the one the translated placeholder spells, wherever it
  // moved.
  const formatsByVariable = new Map<string, Map<string, FormatStyle>>();
  forEachPlaceholder(source, (node) => {
    if (!isFormattedNode(node)) return;
    const key = variableKey(node);
    const formats = formatsByVariable.get(key) ?? new Map();
    formats.set(formatSlot(node), node[2]);
    formatsByVariable.set(key, formats);
  });
  const restored = mapPlaceholders(tree, (node) => {
    if (!isFormattedNode(node)) return node;
    const formats = formatsByVariable.get(variableKey(node));
    if (!formats) return node;
    const slot = formatSlot(node);
    if (formats.size > 1 && !formats.has(slot)) {
      problems.push(`"${node[0]}" uses a format the source does not have`);
      return node;
    }
    const style =
      formats.size > 1 ? formats.get(slot) : formats.values().next().value;
    return style == null ? [node[0], node[1]] : [node[0], node[1], style];
  });
  if (problems.length) {
    throw new Error(createTranslationMismatchError(problems));
  }
  return restored;
}

type FormatStyle = (NumberNode | DateTimeNode)[2];

/**
 * The source without the plural category branches the locale has no use for,
 * which its translation leaves out (per CLDR, a language uses only its own
 * categories, and every value without one falls back to `other`).
 */
function withLocaleCategories(
  source: MessageTree,
  locale: string
): MessageTree {
  // Built only for a plural that has category keys, since most messages have none.
  const categories = new Map<Intl.PluralRuleType, Set<string>>();
  const localeHas = (type: Intl.PluralRuleType, key: string) => {
    let set = categories.get(type);
    if (!set) {
      const rules = new Intl.PluralRules(locale, { type });
      set = new Set(rules.resolvedOptions().pluralCategories);
      categories.set(type, set);
    }
    return set.has(key);
  };
  return mapPlaceholders(source, (node) => {
    if (!isBranchingNode(node) || node[1] === 'select') return node;
    const [name, kind, branches, ...rest] = node as PluralNode;
    const type = kind === 'plural' ? 'cardinal' : 'ordinal';
    const kept = Object.entries(branches).filter(
      ([key]) => !isPluralCategoryKey(key) || localeHas(type, key)
    );
    return [name, kind, Object.fromEntries(kept), ...rest];
  });
}
