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
  TagElement,
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
          return printTag(element);
      }
    })
    .join('');
}

function printTag(element: TagElement): string {
  return `<${element.value}>${printAST(element.children)}</${element.value}>`;
}

function escapeMessage(message: string): string {
  return message.replace(/([{}](?:[\s\S]*[{}])?)/, "'$1'");
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
  return `{${element.value}, ${TYPE[element.type]}${
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
  const message = [
    element.value,
    'select',
    Object.keys(element.options)
      .map(
        (selector) =>
          `${selector}{${printElements(element.options[selector].value, false)}}`
      )
      .join(' '),
  ].join(',');
  return `{${message}}`;
}

function printPlural(element: PluralElement): string {
  const type = element.pluralType === 'cardinal' ? 'plural' : 'selectordinal';
  const message = [
    element.value,
    type,
    [
      element.offset ? `offset:${element.offset}` : '',
      ...Object.keys(element.options).map(
        (selector) =>
          `${selector}{${printElements(element.options[selector].value, true)}}`
      ),
    ]
      .filter(Boolean)
      .join(' '),
  ].join(',');
  return `{${message}}`;
}
