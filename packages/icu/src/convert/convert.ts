import { parse } from '../parser/parse';
import { printAST } from '../parser/printer';
import { normalizeMessageTree } from '../tree/canonical';
import type { MessageFormats } from '../settings/formatOptions';
import type { Message, MessageTree } from '../tree/messageTree';
import {
  fromMessage,
  fromMessageTree,
  readMessage,
  type NamedStyles,
} from './syntaxTree';

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
 * sorted like `templateToMessage` output so it hashes the same way, and holds
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
  return { tree: normalizeMessageTree(tree), formats };
}

/**
 * Prints a valid message tree as an ICU MessageFormat string, e.g. for a
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
  return printAST(fromMessageTree(tree));
}

/** An ICU string, and the formatting context of its message that it does not spell. */
export type IcuMessage = {
  icu: string;
  formats: MessageFormats;
};

/**
 * Prints a message as an ICU MessageFormat string that says as much of it as
 * ICU can: the tree, and the formatting context a skeleton spells, like a
 * currency, digits, a notation or an hour cycle. The context ICU has no
 * syntax for, like a time zone, is returned as `formats`:
 *
 *   messageToIcu({
 *     tree: ['Total: ', ['total', 'number', 'currency']],
 *     formats: { total: { currency: 'EUR', maximumFractionDigits: 0 } },
 *   });
 *   // { icu: 'Total: {total, number, ::currency/EUR precision-integer}', formats: {} }
 *
 *   messageToIcu({
 *     tree: [['due', 'time', { hour: 'numeric', minute: '2-digit' }]],
 *     formats: { due: { hourCycle: 'h23', timeZone: 'Asia/Tokyo' } },
 *   });
 *   // { icu: '{due, time, ::Hmm}', formats: { due: { timeZone: 'Asia/Tokyo' } } }
 *
 * `icuToMessage(icu)` reads the same tree back, and its `formats` with the
 * ones returned here are the message's. To print what a translator sees,
 * which is the tree alone, use `messageTreeToIcu`.
 */
export function messageToIcu(message: Message): IcuMessage {
  const [ast, formats] = fromMessage(message);
  return { icu: printAST(ast), formats };
}
