import { parse } from '../parser/parse';
import { toMessageTree } from '../convert/syntaxTree';
import { libraryDefaultLocale } from '../settings/settings';
import type { MessageVariables } from '../types-dir/ast';
import {
  formatParsedTree,
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
 *   formatMessage('Hi {name}', 'en', { name: 'Ada' }); // 'Hi Ada'
 */
export function formatMessage(
  message: string,
  locales?: string | string[],
  variables?: Readonly<Record<string, MessagePlainValue>>
): string;
/**
 * With rich values or tag formatters, the result is a string, a rich value,
 * or the parts around them, as with `formatMessageTree`.
 */
export function formatMessage<R>(
  message: string,
  locales: string | string[] | undefined,
  variables: MessageTreeValues<R> & OnePartValues<R>
): FormattedMessage<R>;
export function formatMessage(
  message: string,
  locales: string | string[] = libraryDefaultLocale,
  variables: MessageVariables = {}
): unknown {
  const locale = resolveLocale(locales);
  const tree = toMessageTree(parse(message, { locale }));
  return formatParsedTree(tree, message, locales, variables);
}
