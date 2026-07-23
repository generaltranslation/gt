/*
 * Adapted from the FormatJS ICU MessageFormat AST printer (MIT).
 * See THIRD_PARTY_NOTICES.md.
 */

import { SKELETON_TYPE, TYPE } from './types';
import { isAsciiLetter, isTagNameCharacter } from './tag';
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
  return printElements(ast, false, false);
}

function printElements(
  ast: MessageFormatElement[],
  isInPlural: boolean,
  closesContainer: boolean
): string {
  return ast
    .map((element, index) => {
      switch (element.type) {
        case TYPE.literal:
          return printLiteral(
            element,
            isInPlural,
            index > 0,
            index < ast.length - 1 || closesContainer
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
          return `<${element.value}>${printElements(element.children, isInPlural, true)}</${element.value}>`;
      }
    })
    .join('');
}

function quoteSyntaxToken(token: string): string {
  return `'${token.replace(/'/g, "''")}'`;
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
function escapeApostropheRuns(
  value: string,
  isInPlural: boolean,
  followsQuotedSyntax: boolean,
  followsElement: boolean,
  precedesSyntax: boolean
): string {
  let result = '';
  let index = 0;

  while (index < value.length) {
    if (value[index] !== "'") {
      result += value[index];
      index += 1;
      continue;
    }

    const start = index;
    while (value[index] === "'") index += 1;
    const length = index - start;
    const next = value[index];
    const introducesQuote =
      next === '{' ||
      next === '}' ||
      next === '<' ||
      next === '>' ||
      (isInPlural && next === '#');
    const touchesSyntax =
      (start === 0 && followsQuotedSyntax) ||
      (index === value.length && precedesSyntax) ||
      introducesQuote;
    const preservesElementBoundary = start === 0 && followsElement;

    // A single apostrophe is literal unless it introduces ICU syntax. Longer
    // runs otherwise need 2n-1 apostrophes because the parser collapses each
    // pair. At a syntax boundary they need 2n so the boundary apostrophe
    // cannot be mistaken for a quote delimiter. Keep the established doubled
    // spelling for one apostrophe after another AST element; longer runs use
    // the shortest correct encoding rather than changing more hash bytes.
    result +=
      length === 1 && !touchesSyntax && !preservesElementBoundary
        ? "'"
        : "'".repeat(
            touchesSyntax
              ? length * 2
              : length === 1 && preservesElementBoundary
                ? 2
                : length * 2 - 1
          );
  }

  return result;
}

function escapeMessage(
  message: string,
  isInPlural: boolean,
  hasPrecedingSyntax: boolean,
  hasFollowingSyntax: boolean
): string {
  const quotedRanges: Array<{ start: number; end: number }> = [];

  function quoteToken(start: number, end: number): void {
    const previous = quotedRanges[quotedRanges.length - 1];
    if (
      previous &&
      (start === previous.end ||
        /^'+$/u.test(message.slice(previous.end, start)))
    ) {
      // Merge across apostrophe-only gaps. Two independently quoted syntax
      // tokens would otherwise make their closing/opening delimiters combine
      // with the literal apostrophes and change the reparsed value.
      previous.end = end;
    } else {
      quotedRanges.push({ start, end });
    }
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

  let result = '';
  let literalStart = 0;
  for (const range of quotedRanges) {
    result += escapeApostropheRuns(
      message.slice(literalStart, range.start),
      isInPlural,
      literalStart !== 0,
      literalStart === 0 && hasPrecedingSyntax,
      true
    );
    result += quoteSyntaxToken(message.slice(range.start, range.end));
    literalStart = range.end;
  }

  result += escapeApostropheRuns(
    message.slice(literalStart),
    isInPlural,
    literalStart !== 0,
    literalStart === 0 && hasPrecedingSyntax,
    hasFollowingSyntax
  );
  return result;
}

function printLiteral(
  { value }: LiteralElement,
  isInPlural: boolean,
  hasPrecedingSyntax: boolean,
  hasFollowingSyntax: boolean
): string {
  // The parser normalizes self-closing tags into standalone literal elements.
  // Emitting a validated normalized tag raw is safe and preserves that AST
  // boundary. Quoting it independently can join apostrophe delimiters with an
  // adjacent literal and corrupt the rendered message.
  if (isSelfClosingTagLiteral(value)) return value;
  return escapeMessage(
    value,
    isInPlural,
    hasPrecedingSyntax,
    hasFollowingSyntax
  );
}

function isSelfClosingTagLiteral(value: string): boolean {
  if (!value.startsWith('<') || !value.endsWith('/>')) return false;
  const name = value.slice(1, -2);
  let first = true;

  for (const character of name) {
    if (first ? !isAsciiLetter(character) : !isTagNameCharacter(character)) {
      return false;
    }
    first = false;
  }

  return !first;
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
  // argStyleText has its own apostrophe semantics, and the compatibility
  // parser can expose unmatched opening braces from FormatJS's scanner quirk.
  // Re-escaping it as message text changes the style AST and can create an
  // unclosed quote, so preserve the parser-produced bytes exactly.
  if (typeof style === 'string') return style;
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
        `${selector}{${printElements(option.value, inPlural, true)}}`
    )
    .join(' ');
}
