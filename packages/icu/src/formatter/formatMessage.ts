import { parse } from '../parser/parse';
import { toParsedTree } from '../convert/syntaxTree';
import {
  formatParsedTree,
  type FormatMessageTreeOptions,
  type FormattedMessage,
  type MessagePlainValue,
  type MessageValues,
  type OnePartValues,
} from './formatMessageTree';
import { resolveLocale } from './locale';

/** An ICU string spells its own formatting context, so it takes none. */
export type FormatMessageOptions = Pick<FormatMessageTreeOptions, 'timeZone'>;

/**
 * Formats an ICU MessageFormat string: it is parsed to a tree and formatted
 * like `formatMessageTree`, with the same values and result types.
 *
 *   formatMessage('Hi {name}', 'en', { name: 'Ada' }, { timeZone }); // 'Hi Ada'
 */
export function formatMessage(
  message: string,
  locales: string | string[],
  values: Readonly<Record<string, MessagePlainValue>>,
  options: FormatMessageOptions
): string;
/**
 * With rich values or tag formatters, the result is a string, a rich value,
 * or the parts around them, as with `formatMessageTree`.
 */
export function formatMessage<R>(
  message: string,
  locales: string | string[],
  values: MessageValues<R> & OnePartValues<R>,
  options: FormatMessageOptions
): FormattedMessage<R>;
export function formatMessage<R>(
  message: string,
  locales: string | string[],
  values: MessageValues<R>,
  options: FormatMessageOptions
): string | R | Array<string | R> {
  const locale = resolveLocale(locales);
  const tree = toParsedTree(parse(message, { locale }));
  return formatParsedTree(tree, message, locales, values, {
    formats: {},
    timeZone: options.timeZone,
  });
}
