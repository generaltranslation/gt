import { parse } from '../parser/parse';
import { printAST } from '../parser/printer';
import { normalizeTree } from '../tree/canonical';
import type { Message, MessageTree } from '../tree/messageTree';
import { fromMessageTree, readMessage, type NamedStyles } from './syntaxTree';

export type IcuToMessageOptions = {
  /**
   * The app's own style names, for a string like `{n, number, EUR}`, in the
   * shape react-intl takes as its `formats` prop. A name that is neither
   * here nor ICU's throws.
   */
  styles?: NamedStyles;
};

/**
 * Converts an ICU MessageFormat string to a message. Its tree is canonical,
 * sorted like `buildMessageTree` output so it hashes the same way, and holds
 * what a translator sees. The formatting context the string spells, like a
 * currency, digits or an hour cycle, is its `formats`, by variable:
 *
 *   icuToMessage('{n, plural, one {# file} other {# files}}')
 *   // { tree: [['n', 'plural', { one: [0, ' file'], other: [0, ' files'] }]], formats: {} }
 *   icuToMessage('Total: {total, number, ::currency/EUR .00}')
 *   // { tree: ['Total: ', ['total', 'number', 'currency']],
 *   //   formats: { total: { currency: 'EUR', maximumFractionDigits: 2, minimumFractionDigits: 2 } } }
 *
 * `formatMessageTree(tree, locales, values, { formats, timeZone })` formats
 * it as the string would format. A translation of a tree printed with
 * `messageTreeToIcu` is read the same way; `checkTranslation` checks it
 * against its source. Throws a `SyntaxError` for an invalid ICU string, and
 * an `Error` for one variable with two formatting contexts, since `formats`
 * is by variable.
 */
export function icuToMessage(
  icu: string,
  { styles = {} }: IcuToMessageOptions = {}
): Message {
  const { tree, formats } = readMessage(parse(icu), styles);
  return { tree: normalizeTree(tree), formats };
}

/**
 * Prints a message tree as an ICU MessageFormat string, e.g. for a
 * translator, without loss: `icuToMessage` reads it back as the same
 * tree. Named styles print as is, a unit as `::unit/…`, and date and time
 * fields as a skeleton whose hour is `j`, the locale's hour:
 *
 *   messageTreeToIcu([['due', 'date', { day: 'numeric', hour: 'numeric', month: 'short' }]]);
 *   // '{due, date, ::MMMdj}'
 *
 * Throws for a style a tree cannot hold, as `validateMessageTree` reports.
 */
export function messageTreeToIcu(tree: MessageTree): string {
  // The types allow adjacent text, which a valid tree does not have. It must
  // print as one literal: quoting '{' and '}' separately gives '{''}', an
  // escaped quote.
  return printAST(fromMessageTree(normalizeTree(tree)));
}
