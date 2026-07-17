/*
 * ICU MessageFormat grammar and AST compatibility are based on
 * @formatjs/icu-messageformat-parser (MIT). See THIRD_PARTY_NOTICES.md.
 */

import {
  SKELETON_TYPE,
  TYPE,
  type DateTimeSkeleton,
  type DateElement,
  type Location,
  type LocationDetails,
  type MessageFormatElement,
  type NumberSkeleton,
  type NumberElement,
  type ParserOptions,
  type PluralOrSelectOption,
  type TimeElement,
} from './types';
import {
  parseDateTimeSkeletonOptions,
  parseNumberSkeletonOptions,
  parseNumberSkeletonTokens,
  resolveLocaleHourSkeleton,
} from './skeleton';

const WHITE_SPACE = /[\p{White_Space}\u200E\u200F]/u;
const IDENTIFIER_BOUNDARY = /[\p{White_Space}\p{Pattern_Syntax}]/u;
const TAG_NAME_CHARACTER = /^[\p{L}\p{N}_.\-·\u200C\u200D]$/u;

class IcuParser {
  private index = 0;
  private readonly captureLocation: boolean;
  private readonly ignoreTag: boolean;
  private readonly locale?: Intl.Locale;
  private readonly requiresOtherClause: boolean;
  private readonly shouldParseSkeletons: boolean;

  constructor(
    private readonly message: string,
    options: ParserOptions
  ) {
    this.captureLocation = options.captureLocation ?? false;
    this.ignoreTag = options.ignoreTag ?? false;
    this.locale = options.locale;
    this.requiresOtherClause = options.requiresOtherClause ?? false;
    this.shouldParseSkeletons = options.shouldParseSkeletons ?? false;
  }

  parse(): MessageFormatElement[] {
    return this.parseMessage(0, '', false);
  }

  private parseMessage(
    nestingLevel: number,
    parentArgumentType: string,
    expectingCloseTag: boolean
  ): MessageFormatElement[] {
    const elements: MessageFormatElement[] = [];

    while (!this.atEnd()) {
      const character = this.current();
      if (character === '{') {
        elements.push(this.parseArgument(nestingLevel, expectingCloseTag));
      } else if (character === '}' && nestingLevel > 0) {
        break;
      } else if (
        character === '#' &&
        (parentArgumentType === 'plural' ||
          parentArgumentType === 'selectordinal')
      ) {
        const start = this.index;
        this.index += 1;
        elements.push(
          this.withLocation({ type: TYPE.pound }, start, this.index)
        );
      } else if (character === '<' && !this.ignoreTag && this.peek() === '/') {
        if (expectingCloseTag) break;
        this.fail('UNMATCHED_CLOSING_TAG');
      } else if (
        character === '<' &&
        !this.ignoreTag &&
        isAsciiLetter(this.peek())
      ) {
        elements.push(this.parseTag(nestingLevel, parentArgumentType));
      } else {
        elements.push(this.parseLiteral(nestingLevel, parentArgumentType));
      }
    }

    return elements;
  }

  private parseLiteral(
    nestingLevel: number,
    parentArgumentType: string
  ): MessageFormatElement {
    const start = this.index;
    let value = '';

    while (!this.atEnd()) {
      const quote = this.tryParseQuote(parentArgumentType);
      if (quote !== null) {
        value += quote;
        continue;
      }

      const character = this.current();
      if (
        character === '{' ||
        (character === '}' && nestingLevel > 0) ||
        (character === '#' &&
          (parentArgumentType === 'plural' ||
            parentArgumentType === 'selectordinal')) ||
        (character === '<' &&
          !this.ignoreTag &&
          (isAsciiLetter(this.peek()) || this.peek() === '/'))
      ) {
        break;
      }

      value += character;
      this.index += character.length;
    }

    return this.withLocation({ type: TYPE.literal, value }, start, this.index);
  }

  private tryParseQuote(parentArgumentType: string): string | null {
    if (this.current() !== "'") return null;

    const next = this.peek();
    if (next === "'") {
      this.index += 2;
      return "'";
    }

    const quotesSyntax =
      next === '{' ||
      next === '}' ||
      next === '<' ||
      next === '>' ||
      (next === '#' &&
        (parentArgumentType === 'plural' ||
          parentArgumentType === 'selectordinal'));
    if (!quotesSyntax) return null;

    this.index += 1;
    let value = '';
    while (!this.atEnd()) {
      const character = this.current();
      if (character === "'") {
        if (this.peek() === "'") {
          value += "'";
          this.index += 2;
          continue;
        }
        this.index += 1;
        break;
      }
      value += character;
      this.index += character.length;
    }
    return value;
  }

  private parseTag(
    nestingLevel: number,
    parentArgumentType: string
  ): MessageFormatElement {
    const start = this.index;
    this.index += 1;
    const tagName = this.readTagName();
    this.skipSpace();

    if (this.consume('/>')) {
      return this.withLocation(
        { type: TYPE.literal, value: `<${tagName}/>` },
        start,
        this.index
      );
    }

    if (!this.consume('>')) this.fail('INVALID_TAG', start);
    const children = this.parseMessage(
      nestingLevel + 1,
      parentArgumentType,
      true
    );

    if (!this.consume('</')) this.fail('UNCLOSED_TAG', start);
    const closingStart = this.index;
    if (!isAsciiLetter(this.current())) this.fail('INVALID_TAG', closingStart);
    const closingTag = this.readTagName();
    if (closingTag !== tagName) {
      this.fail('UNMATCHED_CLOSING_TAG', closingStart);
    }
    this.skipSpace();
    if (!this.consume('>')) this.fail('INVALID_TAG', closingStart);

    return this.withLocation(
      { type: TYPE.tag, value: tagName, children },
      start,
      this.index
    );
  }

  private readTagName(): string {
    const start = this.index;
    if (!isAsciiLetter(this.current())) this.fail('INVALID_TAG', start);
    this.index += 1;
    while (!this.atEnd() && TAG_NAME_CHARACTER.test(this.current())) {
      this.index += this.current().length;
    }
    return this.message.slice(start, this.index);
  }

  private parseArgument(
    nestingLevel: number,
    expectingCloseTag: boolean
  ): MessageFormatElement {
    const start = this.index;
    this.index += 1;
    this.skipSpace();
    if (this.atEnd()) this.fail('EXPECT_ARGUMENT_CLOSING_BRACE', start);
    if (this.current() === '}') {
      this.index += 1;
      this.fail('EMPTY_ARGUMENT', start);
    }

    const value = this.readIdentifier();
    if (!value) this.fail('MALFORMED_ARGUMENT', start);
    this.skipSpace();

    if (this.consume('}')) {
      return this.withLocation(
        { type: TYPE.argument, value },
        start,
        this.index
      );
    }
    if (this.atEnd()) this.fail('EXPECT_ARGUMENT_CLOSING_BRACE', start);
    if (!this.consume(',')) this.fail('MALFORMED_ARGUMENT', start);
    this.skipSpace();

    const argumentTypeStart = this.index;
    const argumentType = this.readIdentifier();
    if (!argumentType) this.fail('EXPECT_ARGUMENT_TYPE', argumentTypeStart);

    switch (argumentType) {
      case 'number':
      case 'date':
      case 'time':
        return this.parseSimpleArgument(start, value, argumentType);
      case 'plural':
      case 'selectordinal':
      case 'select':
        return this.parseChoiceArgument(
          start,
          value,
          argumentType,
          nestingLevel,
          expectingCloseTag
        );
      default:
        this.fail('INVALID_ARGUMENT_TYPE', argumentTypeStart);
    }
  }

  private parseSimpleArgument(
    start: number,
    value: string,
    argumentType: 'number' | 'date' | 'time'
  ): MessageFormatElement {
    this.skipSpace();
    let style: string | NumberSkeleton | DateTimeSkeleton | null = null;

    if (this.consume(',')) {
      this.skipSpace();
      const styleStart = this.index;
      const rawStyle = this.readSimpleStyle().trimEnd();
      if (!rawStyle) this.fail('EXPECT_ARGUMENT_STYLE', styleStart);

      if (rawStyle.startsWith('::')) {
        const skeleton = rawStyle.slice(2).trimStart();
        const styleLocation = this.location(styleStart, this.index);
        if (argumentType === 'number') {
          const tokens = parseNumberSkeletonTokens(skeleton);
          style = {
            type: SKELETON_TYPE.number,
            tokens,
            ...(styleLocation ? { location: styleLocation } : {}),
            parsedOptions: this.shouldParseSkeletons
              ? parseNumberSkeletonOptions(tokens)
              : {},
          };
        } else {
          if (!skeleton) this.fail('EXPECT_DATE_TIME_SKELETON', styleStart);
          const pattern = resolveLocaleHourSkeleton(skeleton, this.locale);
          style = {
            type: SKELETON_TYPE.dateTime,
            pattern,
            ...(styleLocation ? { location: styleLocation } : {}),
            parsedOptions: this.shouldParseSkeletons
              ? parseDateTimeSkeletonOptions(pattern)
              : {},
          };
        }
      } else {
        style = rawStyle;
      }
    }

    if (!this.consume('}')) {
      this.fail('EXPECT_ARGUMENT_CLOSING_BRACE', start);
    }

    if (argumentType === 'number') {
      return this.withLocation<NumberElement>(
        { type: TYPE.number, value, style: style as NumberElement['style'] },
        start,
        this.index
      );
    }
    if (argumentType === 'date') {
      return this.withLocation<DateElement>(
        { type: TYPE.date, value, style: style as DateElement['style'] },
        start,
        this.index
      );
    }
    return this.withLocation<TimeElement>(
      { type: TYPE.time, value, style: style as TimeElement['style'] },
      start,
      this.index
    );
  }

  private readSimpleStyle(): string {
    const start = this.index;
    let nestedBraces = 0;

    while (!this.atEnd()) {
      const character = this.current();
      if (character === "'") {
        this.index += 1;
        while (!this.atEnd() && this.current() !== "'") {
          this.index += this.current().length;
        }
        if (this.atEnd()) this.fail('UNCLOSED_QUOTE_IN_ARGUMENT_STYLE', start);
        this.index += 1;
      } else if (character === '{') {
        nestedBraces += 1;
        this.index += 1;
      } else if (character === '}') {
        if (nestedBraces === 0) break;
        nestedBraces -= 1;
        this.index += 1;
      } else {
        this.index += character.length;
      }
    }

    return this.message.slice(start, this.index);
  }

  private parseChoiceArgument(
    start: number,
    value: string,
    argumentType: 'plural' | 'selectordinal' | 'select',
    nestingLevel: number,
    expectingCloseTag: boolean
  ): MessageFormatElement {
    this.skipSpace();
    if (!this.consume(',')) this.fail('EXPECT_SELECT_ARGUMENT_OPTIONS');
    this.skipSpace();

    let offset = 0;
    const firstSelectorStart = this.index;
    let selector = this.readIdentifier();
    if (argumentType !== 'select' && selector === 'offset') {
      if (!this.consume(':')) this.fail('EXPECT_PLURAL_ARGUMENT_OFFSET_VALUE');
      this.skipSpace();
      offset = this.readInteger('EXPECT_PLURAL_ARGUMENT_OFFSET_VALUE');
      this.skipSpace();
      selector = this.readIdentifier();
    }

    const entries: Array<[string, PluralOrSelectOption]> = [];
    const seen = new Set<string>();
    let selectorStart = firstSelectorStart;

    while (selector || (argumentType !== 'select' && this.current() === '=')) {
      if (!selector && this.consume('=')) {
        selector = `=${this.readInteger('EXPECT_PLURAL_ARGUMENT_SELECTOR')}`;
      }
      if (seen.has(selector)) this.fail('DUPLICATE_ARGUMENT_SELECTOR');
      seen.add(selector);

      this.skipSpace();
      const optionStart = this.index;
      if (!this.consume('{')) this.fail('EXPECT_ARGUMENT_SELECTOR_FRAGMENT');
      const optionValue = this.parseMessage(
        nestingLevel + 1,
        argumentType,
        expectingCloseTag
      );
      if (!this.consume('}')) {
        this.fail('EXPECT_ARGUMENT_CLOSING_BRACE', optionStart);
      }
      const optionLocation = this.location(optionStart, this.index);
      entries.push([
        selector,
        {
          value: optionValue,
          ...(optionLocation ? { location: optionLocation } : {}),
        },
      ]);

      this.skipSpace();
      selectorStart = this.index;
      selector = this.readIdentifier();
    }

    if (entries.length === 0) this.fail('EXPECT_ARGUMENT_SELECTOR');
    if (
      this.requiresOtherClause &&
      !entries.some(([entrySelector]) => entrySelector === 'other')
    ) {
      this.fail('MISSING_OTHER_CLAUSE', selectorStart);
    }
    if (!this.consume('}')) this.fail('EXPECT_ARGUMENT_CLOSING_BRACE', start);

    const options = Object.fromEntries(entries);
    if (argumentType === 'select') {
      return this.withLocation(
        { type: TYPE.select, value, options },
        start,
        this.index
      );
    }
    return this.withLocation(
      {
        type: TYPE.plural,
        value,
        options,
        offset,
        pluralType: argumentType === 'plural' ? 'cardinal' : 'ordinal',
      },
      start,
      this.index
    );
  }

  private readInteger(errorCode: string): number {
    const start = this.index;
    if (this.current() === '+' || this.current() === '-') this.index += 1;
    const digitStart = this.index;
    while (/\d/u.test(this.current())) this.index += 1;
    if (digitStart === this.index) this.fail(errorCode, start);
    const value = Number(this.message.slice(start, this.index));
    if (!Number.isSafeInteger(value)) this.fail('INVALID_NUMBER', start);
    return value;
  }

  private readIdentifier(): string {
    const start = this.index;
    while (!this.atEnd() && !IDENTIFIER_BOUNDARY.test(this.current())) {
      this.index += this.current().length;
    }
    return this.message.slice(start, this.index);
  }

  private skipSpace(): void {
    while (!this.atEnd() && WHITE_SPACE.test(this.current())) {
      this.index += this.current().length;
    }
  }

  private consume(value: string): boolean {
    if (!this.message.startsWith(value, this.index)) return false;
    this.index += value.length;
    return true;
  }

  private current(): string {
    return String.fromCodePoint(this.message.codePointAt(this.index) ?? 0);
  }

  private peek(): string {
    const current = this.current();
    return String.fromCodePoint(
      this.message.codePointAt(this.index + current.length) ?? 0
    );
  }

  private atEnd(): boolean {
    return this.index >= this.message.length;
  }

  private withLocation<T extends MessageFormatElement>(
    element: T,
    start: number,
    end: number
  ): T {
    const location = this.location(start, end);
    return location ? { ...element, location } : element;
  }

  private location(start: number, end: number): Location | undefined {
    if (!this.captureLocation) return undefined;
    return { start: this.position(start), end: this.position(end) };
  }

  private position(offset: number): LocationDetails {
    const before = this.message.slice(0, offset);
    const lastNewline = before.lastIndexOf('\n');
    return {
      offset,
      line: before.split('\n').length,
      column: Array.from(before.slice(lastNewline + 1)).length + 1,
    };
  }

  private fail(code: string, offset = this.index): never {
    const { line, column } = this.position(offset);
    throw new SyntaxError(`${code} at line ${line}, column ${column}.`);
  }
}

function isAsciiLetter(character: string): boolean {
  return /^[A-Za-z]$/u.test(character);
}

export function parse(
  message: string,
  options: ParserOptions = {}
): MessageFormatElement[] {
  return new IcuParser(message, {
    shouldParseSkeletons: true,
    requiresOtherClause: true,
    ...options,
  }).parse();
}
