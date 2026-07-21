// The code in this file is adapted from the FormatJS printer,
// https://github.com/formatjs/formatjs/blob/main/packages/icu-messageformat-parser/printer.ts
// (published as `@formatjs/icu-messageformat-parser/printer.js`)
// And is therefore MIT licensed

/*!
MIT License

Copyright (c) 2023 FormatJS

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
*/

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

type PrintIcuAstOptions = {
  /**
   * Escape every literal `#` inside plural options instead of only the
   * first (the upstream quirk). Output is no longer byte-identical to
   * FormatJS `printAST`, so never enable this on the hashing path.
   */
  escapeAllPounds?: boolean;
};

/**
 * Local copy of FormatJS `printAST` (see the license header above). The
 * published printer subpath is CommonJS-only, which browsers and Vite-based
 * dev servers (e.g. TanStack Start) cannot load from our ESM build, and the
 * package's ESM variant uses extensionless relative imports that fail Node
 * resolution.
 *
 * By default output stays byte-identical to FormatJS `printAST` because
 * condensed ICU strings feed into hashing.
 */
export function printIcuAst(
  ast: MessageFormatElement[],
  options: PrintIcuAstOptions = {}
): string {
  return doPrintAst(ast, false, options);
}

function doPrintAst(
  ast: MessageFormatElement[],
  isInPlural: boolean,
  options: PrintIcuAstOptions
): string {
  const printedNodes = ast.map((el, i) => {
    switch (el.type) {
      case TYPE.literal:
        return printLiteralElement(
          el,
          isInPlural,
          i === 0,
          i === ast.length - 1,
          options
        );
      case TYPE.argument:
        return `{${el.value}}`;
      case TYPE.date:
      case TYPE.time:
      case TYPE.number:
        return printSimpleFormatElement(el);
      case TYPE.plural:
        return printPluralElement(el, options);
      case TYPE.select:
        return printSelectElement(el, options);
      case TYPE.pound:
        return '#';
      case TYPE.tag:
        return printTagElement(el, isInPlural, options);
    }
  });
  return printedNodes.join('');
}

function printTagElement(
  el: TagElement,
  isInPlural: boolean,
  options: PrintIcuAstOptions
): string {
  // The parser keeps plural context inside tags (a bare `#` in a tag inside
  // a plural option is a pound element), but upstream's printer resets it.
  // Preserve the context when escaping all pounds; keep the upstream reset
  // otherwise so default output stays byte-identical.
  const childrenInPlural = options.escapeAllPounds ? isInPlural : false;
  return `<${el.value}>${doPrintAst(el.children, childrenInPlural, options)}</${el.value}>`;
}

function printEscapedMessage(message: string): string {
  return message.replace(/([{}](?:[\s\S]*[{}])?)/, "'$1'");
}

function printLiteralElement(
  { value }: LiteralElement,
  isInPlural: boolean,
  isFirstEl: boolean,
  isLastEl: boolean,
  options: PrintIcuAstOptions
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
  if (!isInPlural) return escaped;
  // Upstream escapes only the first `#` (String#replace with a string
  // pattern); keep the quirk by default so output stays byte-identical
  return options.escapeAllPounds
    ? escaped.split('#').join("'#'")
    : escaped.replace('#', "'#'");
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

function printSelectElement(
  el: SelectElement,
  options: PrintIcuAstOptions
): string {
  const msg = [
    el.value,
    'select',
    Object.keys(el.options)
      .map((id) => `${id}{${doPrintAst(el.options[id].value, false, options)}}`)
      .join(' '),
  ].join(',');
  return `{${msg}}`;
}

function printPluralElement(
  el: PluralElement,
  options: PrintIcuAstOptions
): string {
  const type = el.pluralType === 'cardinal' ? 'plural' : 'selectordinal';
  const msg = [
    el.value,
    type,
    [
      el.offset ? `offset:${el.offset}` : '',
      ...Object.keys(el.options).map(
        (id) => `${id}{${doPrintAst(el.options[id].value, true, options)}}`
      ),
    ]
      .filter(Boolean)
      .join(' '),
  ].join(',');
  return `{${msg}}`;
}
