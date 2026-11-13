/*
 * Formatting an ICU string without making it a message. Everything that
 * exists only for that is in this file: the tree it is parsed to, how that
 * tree is made, and `formatIcu`. A message is formatted by
 * `formatMessageTree`, which never loads the parser.
 */

import { parse } from '../parser/parse';
import {
  dateTimeOptions,
  toNodes,
  type FormatElement,
} from '../convert/syntaxTree';
import { toMessageTree } from '../tree/canonical';
import type { MessageTree } from '../tree/messageTree';
import {
  TYPE,
  type ExtendedNumberFormatOptions,
  type MessageFormatElement,
} from '../types-dir/ast';
import {
  formatParsedTree,
  type FormatMessageTreeOptions,
  type FormattedMessage,
  type MessagePlainValue,
  type MessageValues,
  type OnePartValues,
} from './formatMessageTree';
import { resolveLocale } from './locale';

/**
 * A number, date or time as the formatter reads it. A message tree's nodes
 * are these too. An ICU string's can also hold any style name and every Intl
 * option of a skeleton, which a message tree does not hold.
 */
export type ParsedNode =
  | readonly [
      name: string,
      kind: 'number',
      style?: string | ExtendedNumberFormatOptions,
    ]
  | readonly [
      name: string,
      kind: 'date' | 'time',
      style?: string | Intl.DateTimeFormatOptions,
    ];

/** What the formatter reads: a message tree, or an ICU string's syntax tree. */
export type ParsedTree = MessageTree<ParsedNode>;

/**
 * The parser's syntax tree as the formatter reads it: a formatted placeholder
 * keeps every Intl option its skeleton spells, which a message tree cannot
 * hold.
 */
function toParsedTree(ast: MessageFormatElement[]): ParsedTree {
  // Plain text as one string takes the formatter's fast path.
  return toMessageTree(toNodes(ast, parsedNode));
}

/** The style is the name, or every Intl option the skeleton spells. */
function parsedNode(element: FormatElement): ParsedNode {
  if (element.type === TYPE.number) {
    const style = element.style ?? undefined;
    return [
      element.value,
      'number',
      typeof style === 'object' ? style.parsedOptions : style,
    ];
  }
  const style = element.style ?? undefined;
  return [
    element.value,
    element.type === TYPE.date ? 'date' : 'time',
    typeof style === 'object' ? dateTimeOptions(style) : style,
  ];
}

/** An ICU string spells its own formatting context, so it takes none. */
export type FormatIcuOptions = Pick<FormatMessageTreeOptions, 'timeZone'>;

/**
 * Formats an ICU MessageFormat string: it is parsed to a tree and formatted
 * like `formatMessageTree`, with the same values and result types.
 *
 *   formatIcu('Hi {name}', 'en', { name: 'Ada' }, { timeZone }); // 'Hi Ada'
 */
export function formatIcu(
  icu: string,
  locales: string | string[],
  values: Readonly<Record<string, MessagePlainValue>>,
  options: FormatIcuOptions
): string;
/**
 * With rich values or tag formatters, the result is a string, a rich value,
 * or the parts around them, as with `formatMessageTree`.
 */
export function formatIcu<R>(
  icu: string,
  locales: string | string[],
  values: MessageValues<R> & OnePartValues<R>,
  options: FormatIcuOptions
): FormattedMessage<R>;
export function formatIcu<R>(
  icu: string,
  locales: string | string[],
  values: MessageValues<R>,
  options: FormatIcuOptions
): string | R | Array<string | R> {
  const locale = resolveLocale(locales);
  const tree = toParsedTree(parse(icu, { locale }));
  return formatParsedTree(tree, icu, locales, values, {
    formats: {},
    timeZone: options.timeZone,
  });
}
