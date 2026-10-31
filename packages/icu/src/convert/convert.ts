import { parse } from '../parser/parse';
import { printAST } from '../parser/printer';
import {
  createConflictingSourceFormatsError,
  createTranslationMismatchError,
} from '../errors/convertErrors';
import { canonicalTree } from '../tree/canonical';
import type { MessageTree } from '../tree/messageTree';
import {
  collectVariables,
  findConflictingFormat,
  variableKey,
} from '../tree/variables';
import { isFormattedNode, mapPlaceholders } from '../tree/walk';
import { fromMessageTree, toMessageTree } from './syntaxTree';

export type IcuToMessageTreeOptions = {
  /**
   * The tree this ICU string was printed from with `messageTreeToIcu`, such
   * as the source of a translation. Its formats replace the string's, which
   * restores Intl options ICU cannot spell, and the string must use the same
   * variables.
   */
  source?: MessageTree;
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
 * kind or plural offset.
 */
export function icuToMessageTree(
  icu: string,
  { source }: IcuToMessageTreeOptions = {}
): MessageTree {
  const tree = toMessageTree(parse(icu));
  return canonicalTree(source ? restoreFormats(tree, source) : tree);
}

/**
 * Prints a message tree as an ICU MessageFormat string, e.g. for a
 * translator. Intl options print as a standard ICU skeleton, or the named
 * `percent` style, that standard ICU reads as the same options and
 * `icuToMessageTree` reads back exactly, whatever the locale or time zone.
 * Engines still apply their own defaults, as for any `{n, number}`: ICU4C
 * rounds half-even where Intl rounds half away from zero.
 *
 *   messageTreeToIcu([['price', 'number', { currency: 'USD', style: 'currency' }]]);
 *   // '{price, number, ::currency/USD}'
 *
 * Options with no such spelling, such as `{ dateStyle: 'medium' }` or a
 * `timeZone`, are dropped whole; `icuToMessageTree(icu, { source })`
 * restores them. Named styles are kept.
 */
export function messageTreeToIcu(tree: MessageTree): string {
  // Canonical first: adjacent text must print as one literal, since
  // quoting '{' and '}' separately gives '{''}', an escaped quote.
  return printAST(fromMessageTree(canonicalTree(tree)));
}

function restoreFormats(tree: MessageTree, source: MessageTree): MessageTree {
  // Restoring by variable needs one format per variable in the source.
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
  for (const [key, node] of sourceVariables) {
    if (!translationVariables.has(key)) {
      problems.push(`"${node[0]}" is missing from the translation`);
    }
  }
  if (problems.length) {
    throw new Error(createTranslationMismatchError(problems));
  }

  // The source decides formats: a translation cannot change a currency or
  // drop the time from a date.
  return mapPlaceholders(tree, (node) => {
    if (!isFormattedNode(node)) return node;
    const source = sourceVariables.get(variableKey(node));
    const style = source && isFormattedNode(source) ? source[2] : undefined;
    return style == null ? [node[0], node[1]] : [node[0], node[1], style];
  });
}
