import { SKELETON_TYPE, TYPE } from '@formatjs/icu-messageformat-parser';
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
} from '@formatjs/icu-messageformat-parser';

type SimpleFormatStyle = NonNullable<
  (DateElement | TimeElement | NumberElement)['style']
>;

/**
 * Vendored from FormatJS `@formatjs/icu-messageformat-parser/printer.js`
 * (MIT licensed, https://github.com/formatjs/formatjs). That subpath is
 * CommonJS-only, which browsers and Vite-based dev servers (e.g. TanStack
 * Start) cannot load from our ESM build, and the package's ESM variant uses
 * extensionless relative imports that fail Node resolution.
 *
 * Output must stay byte-identical to FormatJS `printAST` because condensed
 * ICU strings feed into hashing.
 */
export function printIcuAst(ast: MessageFormatElement[]): string {
  return doPrintAst(ast, false);
}

function doPrintAst(ast: MessageFormatElement[], isInPlural: boolean): string {
  const printedNodes = ast.map((el, i) => {
    switch (el.type) {
      case TYPE.literal:
        return printLiteralElement(
          el,
          isInPlural,
          i === 0,
          i === ast.length - 1
        );
      case TYPE.argument:
        return `{${el.value}}`;
      case TYPE.date:
      case TYPE.time:
      case TYPE.number:
        return printSimpleFormatElement(el);
      case TYPE.plural:
        return printPluralElement(el);
      case TYPE.select:
        return printSelectElement(el);
      case TYPE.pound:
        return '#';
      case TYPE.tag:
        return printTagElement(el);
    }
  });
  return printedNodes.join('');
}

function printTagElement(el: TagElement): string {
  return `<${el.value}>${printIcuAst(el.children)}</${el.value}>`;
}

function printEscapedMessage(message: string): string {
  return message.replace(/([{}](?:[\s\S]*[{}])?)/, "'$1'");
}

function printLiteralElement(
  { value }: LiteralElement,
  isInPlural: boolean,
  isFirstEl: boolean,
  isLastEl: boolean
): string {
  let escaped = value;
  // If this literal starts with a ' and it's not the 1st node, the node
  // before it is non-literal and the `'` needs to be re-escaped
  if (!isFirstEl && escaped[0] === "'") {
    escaped = `''${escaped.slice(1)}`;
  }
  // Same logic but for last el
  if (!isLastEl && escaped[escaped.length - 1] === "'") {
    escaped = `${escaped.slice(0, escaped.length - 1)}''`;
  }
  escaped = printEscapedMessage(escaped);
  // Upstream escapes only the first `#` (String#replace with a string
  // pattern); keep the quirk so output stays byte-identical
  return isInPlural ? escaped.replace('#', "'#'") : escaped;
}

function printSimpleFormatElement(
  el: DateElement | TimeElement | NumberElement
): string {
  return `{${el.value}, ${TYPE[el.type]}${
    el.style ? `, ${printArgumentStyle(el.style)}` : ''
  }}`;
}

function printNumberSkeletonToken(
  token: NumberSkeleton['tokens'][number]
): string {
  const { stem, options } = token;
  return options.length === 0
    ? stem
    : `${stem}${options.map((o) => `/${o}`).join('')}`;
}

function printArgumentStyle(style: SimpleFormatStyle): string {
  if (typeof style === 'string') {
    return printEscapedMessage(style);
  } else if (style.type === SKELETON_TYPE.dateTime) {
    return `::${style.pattern}`;
  } else {
    return `::${style.tokens.map(printNumberSkeletonToken).join(' ')}`;
  }
}

function printSelectElement(el: SelectElement): string {
  const msg = [
    el.value,
    'select',
    Object.keys(el.options)
      .map((id) => `${id}{${doPrintAst(el.options[id].value, false)}}`)
      .join(' '),
  ].join(',');
  return `{${msg}}`;
}

function printPluralElement(el: PluralElement): string {
  const type = el.pluralType === 'cardinal' ? 'plural' : 'selectordinal';
  const msg = [
    el.value,
    type,
    [
      el.offset ? `offset:${el.offset}` : '',
      ...Object.keys(el.options).map(
        (id) => `${id}{${doPrintAst(el.options[id].value, true)}}`
      ),
    ]
      .filter(Boolean)
      .join(' '),
  ].join(',');
  return `{${msg}}`;
}
