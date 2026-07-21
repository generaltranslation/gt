/*
 * Adapted from the FormatJS ICU MessageFormat AST printer (MIT).
 * See THIRD_PARTY_NOTICES.md.
 */

import { SKELETON_TYPE, TYPE } from './types';
import type {
  DateElement,
  LiteralElement,
  MessageFormatElement,
  NumberElement,
  NumberSkeleton,
  PluralElement,
  SelectElement,
  TimeElement,
} from './types';

type SimpleFormatStyle = NonNullable<
  (DateElement | TimeElement | NumberElement)['style']
>;

export function printAST(ast: MessageFormatElement[]): string {
  return printElements(ast, false);
}

function printElements(
  ast: MessageFormatElement[],
  isInPlural: boolean
): string {
  return ast
    .map((element, index) => {
      switch (element.type) {
        case TYPE.literal:
          return printLiteral(
            element,
            isInPlural,
            index === 0,
            index === ast.length - 1
          );
        case TYPE.argument:
          return `{${element.value}}`;
        case TYPE.date:
        case TYPE.time:
        case TYPE.number:
          return printSimpleFormat(element);
        case TYPE.plural:
          return printPlural(element);
        case TYPE.select:
          return printSelect(element);
        case TYPE.pound:
          return '#';
        case TYPE.tag:
          return `<${element.value}>${printElements(element.children, isInPlural)}</${element.value}>`;
      }
    })
    .join('');
}

function quoteSyntaxToken(token: string): string {
  return `'${token.replace(/'/g, "''")}'`;
}

function isAsciiLetter(character: string | undefined): boolean {
  if (!character) return false;
  const code = character.charCodeAt(0);
  return (code >= 65 && code <= 90) || (code >= 97 && code <= 122);
}

function isTagSyntaxStart(message: string, index: number): boolean {
  if (message[index] !== '<') return false;
  const next = message[index + 1];
  return next === '/' || isAsciiLetter(next);
}

function findTagSyntaxEnd(message: string, index: number): number {
  const closingIndex = message.indexOf('>', index + 1);
  return closingIndex === -1 ? message.length : closingIndex + 1;
}

function findBraceSyntaxEnd(message: string, index: number): number {
  // Preserve the established canonical bytes by quoting from the first brace
  // through the final brace as one span. Hashes inside that span are already
  // protected and must not be quoted again.
  return (
    Math.max(message.lastIndexOf('{'), message.lastIndexOf('}'), index) + 1
  );
}

/**
 * FormatJS 2.11.4 escaped plural `#` characters with a single
 * `replace('#', "'#'")` after escaping braces. That only protected the first
 * hash and could nest a hash quote inside an existing brace quote. In a real
 * parse -> print -> parse -> format flow, a literal `##` therefore became
 * `#<plural value>` (for example, `#7`) instead of remaining `##`.
 *
 * We intentionally diverge from that released behavior by quoting adjacent
 * ICU syntax as one span, preserving literals such as `##`, `{#}`, and hashes
 * nested in plural tags. FormatJS 3.5.x later adopted the same syntax-run
 * strategy to make printer output round-trippable.
 */
function escapeMessage(message: string, isInPlural = false): string {
  let result = '';
  let literalStart = 0;
  let quotedStart = -1;
  let quotedEnd = -1;

  function flushQuotedToken(): void {
    if (quotedStart === -1) return;

    const literal = message.slice(literalStart, quotedStart);
    result += literal;
    if (literal.endsWith("'")) result += "'";
    result += quoteSyntaxToken(message.slice(quotedStart, quotedEnd));
    literalStart = quotedEnd;
    quotedStart = -1;
  }

  function quoteToken(start: number, end: number): void {
    if (quotedStart !== -1 && start === quotedEnd) {
      quotedEnd = end;
      return;
    }
    flushQuotedToken();
    quotedStart = start;
    quotedEnd = end;
  }

  for (let index = 0; index < message.length; index += 1) {
    const character = message[index];
    if (character === '{') {
      const end = findBraceSyntaxEnd(message, index);
      quoteToken(index, end);
      index = end - 1;
    } else if (character === '}') {
      quoteToken(index, index + 1);
    } else if (isTagSyntaxStart(message, index)) {
      const end = findTagSyntaxEnd(message, index);
      quoteToken(index, end);
      index = end - 1;
    } else if (isInPlural && character === '#') {
      quoteToken(index, index + 1);
    }
  }

  flushQuotedToken();
  return result + message.slice(literalStart);
}

function printLiteral(
  { value }: LiteralElement,
  isInPlural: boolean,
  isFirstElement: boolean,
  isLastElement: boolean
): string {
  let escaped = value;
  if (!isFirstElement && escaped[0] === "'") {
    escaped = `''${escaped.slice(1)}`;
  }
  if (!isLastElement && escaped[escaped.length - 1] === "'") {
    escaped = `${escaped.slice(0, -1)}''`;
  }
  return escapeMessage(escaped, isInPlural);
}

function printSimpleFormat(
  element: DateElement | TimeElement | NumberElement
): string {
  const type =
    element.type === TYPE.number
      ? 'number'
      : element.type === TYPE.date
        ? 'date'
        : 'time';
  return `{${element.value}, ${type}${
    element.style ? `, ${printStyle(element.style)}` : ''
  }}`;
}

function printNumberSkeletonToken(
  token: NumberSkeleton['tokens'][number]
): string {
  return token.options.length === 0
    ? token.stem
    : `${token.stem}${token.options.map((option) => `/${option}`).join('')}`;
}

function printStyle(style: SimpleFormatStyle): string {
  if (typeof style === 'string') return escapeMessage(style);
  if (style.type === SKELETON_TYPE.dateTime) return `::${style.pattern}`;
  return `::${style.tokens.map(printNumberSkeletonToken).join(' ')}`;
}

function printSelect(element: SelectElement): string {
  return `{${element.value},select,${printOptions(element.options, false)}}`;
}

function printPlural(element: PluralElement): string {
  const type = element.pluralType === 'cardinal' ? 'plural' : 'selectordinal';
  const offset = element.offset ? `offset:${element.offset} ` : '';
  return `{${element.value},${type},${offset}${printOptions(element.options, true)}}`;
}

function printOptions(
  options: SelectElement['options'],
  inPlural: boolean
): string {
  return Object.entries(options)
    .map(
      ([selector, option]) =>
        `${selector}{${printElements(option.value, inPlural)}}`
    )
    .join(' ');
}
