import { parse } from '../parser/parse';
import { toFormattingTree } from '../convert/syntaxTree';
import {
  formatParsedTree,
  type FormatMessageTreeOptions,
  type FormattedMessage,
  type MessagePlainValue,
  type MessageTreeValues,
  type OnePartValues,
} from './formatMessageTree';
import { resolveLocale } from './locale';

/**
 * Formats an ICU MessageFormat string: it is parsed to a message tree and
 * formatted like `formatMessageTree`, with the same values and result types.
 *
 *   formatMessage('Hi {name}', 'en', { name: 'Ada' }, { timeZone }); // 'Hi Ada'
 */
export function formatMessage(
  message: string,
  locales: string | string[],
  variables: Readonly<Record<string, MessagePlainValue>>,
  options: FormatMessageTreeOptions
): string;
/**
 * With rich values or tag formatters, the result is a string, a rich value,
 * or the parts around them, as with `formatMessageTree`.
 */
export function formatMessage<R>(
  message: string,
  locales: string | string[],
  variables: MessageTreeValues<R> & OnePartValues<R>,
  options: FormatMessageTreeOptions
): FormattedMessage<R>;
export function formatMessage<R>(
  message: string,
  locales: string | string[],
  variables: MessageTreeValues<R>,
  options: FormatMessageTreeOptions
): string | R | Array<string | R> {
  const locale = resolveLocale(locales);
  const tree = toFormattingTree(parse(message, { locale }));
  return formatParsedTree(tree, message, locales, variables, options);
}
