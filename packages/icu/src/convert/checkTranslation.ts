import { createTranslationMismatchError } from '../errors/convertErrors';
import { printAST } from '../parser/printer';
import { isPluralCategoryKey } from '../settings/syntax';
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
   * The translation's locale. Plural categories the locale does not have,
   * like `one` in Japanese, may be left out, together with the variables
   * and formats only they use.
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
 */
export function checkTranslation(
  source: MessageTree,
  { tree: translation, formats }: Message,
  { locale }: CheckTranslationOptions = {}
): string | undefined {
  const required = locale ? withLocaleCategories(source, locale) : source;
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
    const type = node[1] === 'plural' ? 'cardinal' : 'ordinal';
    const kept = Object.entries(node[2]).filter(
      ([key]) => !isPluralCategoryKey(key) || localeHas(type, key)
    );
    return withBranches(node, Object.fromEntries(kept));
  });
}
