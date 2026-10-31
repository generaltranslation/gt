import { parse } from '../parser/parse';
import { libraryDefaultLocale } from '../settings/settings';
import type { MessageVariables } from '../types-dir/ast';
import { formatParsedAst } from './formatAst';
import { resolveLocale } from './locale';

export function formatMessage(
  message: string,
  locales: string | string[] = libraryDefaultLocale,
  variables: MessageVariables = {}
): unknown {
  const locale = resolveLocale(locales);
  const ast = parse(message, { locale });
  return formatParsedAst(ast, message, locales, variables);
}
