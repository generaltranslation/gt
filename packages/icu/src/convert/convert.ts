import { parse } from '../parser/parse';
import { printAST } from '../parser/printer';
import { normalizeTree } from '../tree/canonical';
import type { MessageTree } from '../tree/messageTree';
import { fromMessageTree, toMessageTree } from './syntaxTree';

/**
 * Converts an ICU MessageFormat string to a canonical message tree, sorted
 * like `buildMessageTree` output so it hashes the same way:
 *
 *   icuToMessageTree('{n, plural, one {# file} other {# files}}')
 *   // [['n', 'plural', { one: [0, ' file'], other: [0, ' files'] }]]
 *
 * A tree holds only what ICU spells, so a translation of a tree printed with
 * `messageTreeToIcu` converts back on its own; `checkTranslation` checks it
 * against its source. Throws a `SyntaxError` for an invalid ICU string, and
 * an `Error` for a format a tree cannot hold, such as `{n, number, ::.00}`,
 * whose options are formatting context.
 */
export function icuToMessageTree(icu: string): MessageTree {
  return normalizeTree(toMessageTree(parse(icu)));
}

/**
 * Prints a message tree as an ICU MessageFormat string, e.g. for a
 * translator, without loss: `icuToMessageTree` reads it back as the same
 * tree. Named styles print as is, a unit as `::unit/…`, and date and time
 * fields as a skeleton whose hour is `j`, the locale's hour:
 *
 *   messageTreeToIcu([['due', 'date', { day: 'numeric', hour: 'numeric', month: 'short' }]]);
 *   // '{due, date, ::MMMdj}'
 *
 * Throws for a style a tree cannot hold, as `validateMessageTree` reports.
 */
export function messageTreeToIcu(tree: MessageTree): string {
  // Canonical first: adjacent text must print as one literal, since
  // quoting '{' and '}' separately gives '{''}', an escaped quote.
  return printAST(fromMessageTree(normalizeTree(tree)));
}
