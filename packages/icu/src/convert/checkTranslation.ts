import { createTranslationMismatchError } from '../errors/convertErrors';
import { printAST } from '../parser/printer';
import { isPluralCategoryKey, PLURAL_CATEGORIES } from '../settings/syntax';
import type {
  DateTimeNode,
  Message,
  MessageTree,
  NumberNode,
} from '../tree/messageTree';
import { collectVariables, formatKey, variableKey } from '../tree/variables';
import {
  forEachPlaceholder,
  isBranchingNode,
  isFormattedNode,
  mapPlaceholders,
  withBranches,
} from '../tree/walk';
import { fromMessageTree } from './syntaxTree';

export type CheckTranslationOptions = {
  /**
   * The translation's locale. With it, each plural and selectordinal needs a
   * branch for every category the locale has, like `few` and `many` in
   * Russian. Categories it does not have, like `one` in Japanese, may be
   * left out, together with the variables and formats only they use.
   */
  locale?: string;
};

/**
 * Checks a translation, as `icuToMessage` reads it, against its source tree,
 * and returns `undefined` when it matches, or a message listing every
 * problem. Text, word order and branch content are free; the translation
 * must use the same variables, by name, kind and plural offset, and format
 * each `number`, `date` or `time` placeholder with a style the source uses
 * for it, keeping every such style:
 *
 *   const source = [['n', 'plural', { one: ['Only ', ['name']], other: [0, ' files'] }]];
 *   checkTranslation(source, icuToMessage('{n, plural, other {#件}}'), { locale: 'ja' });
 *   // undefined
 *   checkTranslation(source, icuToMessage('{n, plural, other {#件}}'));
 *   // 'The translation does not match its source: "name" is missing from the translation.'
 *
 * A translation says the sentence; how a value is rendered is the source's.
 * So formatting context the translation sets, in its `formats`, like a
 * currency, digits or an hour cycle, is a problem too.
 *
 * With a `locale`, the plural branches are checked as well, since a value
 * with no branch for its category falls back to `other` and reads wrong:
 *
 *   checkTranslation(source, icuToMessage('{n, plural, one {# файл} other {# файлов}}'), { locale: 'ru' });
 *   // '… "n" is missing the plural branches few, many, which ru needs.'
 */
export function checkTranslation(
  source: MessageTree,
  { tree: translation, formats }: Message,
  { locale }: CheckTranslationOptions = {}
): string | undefined {
  const plurals = pluralLocale(locale);
  const required = plurals ? withLocaleCategories(source, plurals) : source;
  const sourceVariables = collectVariables(source);
  const requiredVariables = collectVariables(required);
  const translationVariables = collectVariables(translation);
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
  for (const [key, node] of requiredVariables) {
    if (!translationVariables.has(key)) {
      problems.push(`"${node[0]}" is missing from the translation`);
    }
  }

  // Formats of variables both use; a variable problem is reported above.
  const sourceFormats = collectFormats(source);
  const requiredFormats = collectFormats(required);
  const translationFormats = collectFormats(translation);
  for (const [key, formats] of translationFormats) {
    const allowed = sourceFormats.get(key);
    if (!allowed) continue;
    for (const [format, node] of formats) {
      if (!allowed.has(format)) {
        problems.push(
          `"${node[0]}" uses ${printNode(node)}, which the source does not`
        );
      }
    }
  }
  for (const [key, formats] of requiredFormats) {
    const used = translationFormats.get(key);
    if (!used) continue;
    for (const [format, node] of formats) {
      if (!used.has(format)) {
        problems.push(`"${node[0]}" is missing ${printNode(node)}`);
      }
    }
  }
  for (const [name, formatting] of Object.entries(formats)) {
    problems.push(
      `"${name}" sets ${Object.keys(formatting).join(', ')}, which a translation cannot set`
    );
  }
  if (plurals) problems.push(...pluralBranchProblems(translation, plurals));
  return problems.length ? createTranslationMismatchError(problems) : undefined;
}

type FormattedNode = NumberNode | DateTimeNode;

/** The formats of each formatted variable, by `variableKey` and `formatKey`. */
function collectFormats(
  tree: MessageTree
): Map<string, Map<string, FormattedNode>> {
  const formats = new Map<string, Map<string, FormattedNode>>();
  forEachPlaceholder(tree, (node) => {
    if (!isFormattedNode(node)) return;
    const key = variableKey(node);
    const variableFormats = formats.get(key) ?? new Map();
    variableFormats.set(formatKey(node[2]), node);
    formats.set(key, variableFormats);
  });
  return formats;
}

function printNode(node: FormattedNode): string {
  return printAST(fromMessageTree([node]));
}

type PluralLocale = {
  locale: string;
  /** The locale's plural categories, cardinal or ordinal. */
  categories: (type: Intl.PluralRuleType) => ReadonlySet<string>;
};

/**
 * A locale's plural categories, or nothing when Intl has no rules for it:
 * Intl would answer with the host's language instead.
 */
function pluralLocale(locale: string | undefined): PluralLocale | undefined {
  if (!locale || !Intl.PluralRules.supportedLocalesOf(locale).length) {
    return undefined;
  }
  // Built only for a plural that asks, since most messages have none.
  const built = new Map<Intl.PluralRuleType, ReadonlySet<string>>();
  return {
    locale,
    categories: (type) => {
      let categories = built.get(type);
      if (!categories) {
        const rules = new Intl.PluralRules(locale, { type });
        categories = new Set(rules.resolvedOptions().pluralCategories);
        built.set(type, categories);
      }
      return categories;
    },
  };
}

const ruleType = (kind: 'plural' | 'selectordinal'): Intl.PluralRuleType =>
  kind === 'plural' ? 'cardinal' : 'ordinal';

/**
 * The source without the plural category branches the locale has no use for,
 * which its translation leaves out (per CLDR, a language uses only its own
 * categories, and every value without one falls back to `other`).
 */
function withLocaleCategories(
  source: MessageTree,
  { categories }: PluralLocale
): MessageTree {
  return mapPlaceholders(source, (node) => {
    if (!isBranchingNode(node) || node[1] === 'select') return node;
    const has = categories(ruleType(node[1]));
    const kept = Object.entries(node[2]).filter(
      ([key]) => !isPluralCategoryKey(key) || has.has(key)
    );
    return withBranches(node, Object.fromEntries(kept));
  });
}

/**
 * Each plural that lacks a branch for a category its locale has, or has a
 * branch that is no category at all. A category the locale does not have is
 * left alone: its branch is never chosen.
 */
function pluralBranchProblems(
  translation: MessageTree,
  { locale, categories }: PluralLocale
): Set<string> {
  const problems = new Set<string>();
  forEachPlaceholder(translation, (node) => {
    if (!isBranchingNode(node) || node[1] === 'select') return;
    const what = node[1] === 'plural' ? 'plural' : 'ordinal';
    const keys = Object.keys(node[2]);
    const missing = [...categories(ruleType(node[1]))].filter(
      (category) => !keys.includes(category)
    );
    if (missing.length) {
      problems.add(
        `"${node[0]}" is missing the ${what} ${
          missing.length > 1 ? 'branches' : 'branch'
        } ${missing.join(', ')}, which ${locale} needs`
      );
    }
    for (const key of keys) {
      if (key[0] !== '=' && !PLURAL_CATEGORIES.has(key)) {
        problems.add(
          `"${node[0]}" has the ${what} branch ${key}, which is not a plural category`
        );
      }
    }
  });
  return problems;
}
