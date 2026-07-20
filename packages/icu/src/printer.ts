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
          return `<${element.value}>${printAST(element.children)}</${element.value}>`;
      }
    })
    .join('');
}

function escapeMessage(message: string): string {
  return message.replace(/([{}](?:[\s\S]*[{}])?)/, (matched) => {
    return `'${matched.replace(/'/g, "''")}'`;
  });
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
  escaped = escapeMessage(escaped);
  return isInPlural ? escaped.replace('#', "'#'") : escaped;
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
