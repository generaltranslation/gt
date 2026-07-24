/*
 * ICU MessageFormat grammar and AST compatibility are based on
 * @formatjs/icu-messageformat-parser (MIT). See THIRD_PARTY_NOTICES.md.
 */

import {
  SKELETON_TYPE,
  TYPE,
  type DateTimeSkeleton,
  type Location,
  type LocationDetails,
  type MessageFormatElement,
  type NumberSkeleton,
  type ParserOptions,
  type PluralOrSelectOption,
} from './types';
import {
  parseDateTimeSkeletonOptions,
  parseNumberSkeletonOptions,
  parseNumberSkeletonTokens,
  resolveLocaleHourSkeleton,
} from './skeleton';
import { isAsciiLetter, isTagNameCharacter } from './tag';

// FormatJS distinguishes ICU grammar whitespace (Pattern_White_Space) from
// the broader Unicode whitespace set used to terminate identifiers. Keeping
// these separate matters for named styles such as `\u00A0percent`.
const GRAMMAR_WHITE_SPACE = /[\t-\r \x85\u200E\u200F\u2028\u2029]/u;
// Explicit Unicode White_Space + Pattern_Syntax ranges avoid a module-load
// syntax error in engines that support `u` regexes but not property escapes.
const IDENTIFIER_BOUNDARY =
  /[\t-\r \x85\xA0\u1680\u2000-\u200A\u2028\u2029\u202F\u205F\u3000\x21-\x2F\x3A-\x40\x5B-\x5E\x60\x7B-\x7E\xA1-\xA7\xA9\xAB\xAC\xAE\xB0\xB1\xB6\xBB\xBF\xD7\xF7\u2010-\u2027\u2030-\u203E\u2041-\u2053\u2055-\u205E\u2190-\u245F\u2500-\u2775\u2794-\u2BFF\u2E00-\u2E7F\u3001-\u3003\u3008-\u3020\u3030\uFD3E-\uFD3F\uFE45-\uFE46]/u;

type PositionIndex = [lines: Uint32Array, columns: Uint32Array];

class IcuParser {
  private index = 0;
  private positions?: PositionIndex;

  constructor(
    private readonly message: string,
    private readonly options: ParserOptions
  ) {}

  parse(): MessageFormatElement[] {
    return this.parseMessage(false, false, false);
  }

  private parseMessage(
    nested: boolean,
    inPlural: boolean,
    expectingCloseTag: boolean
  ): MessageFormatElement[] {
    const elements: MessageFormatElement[] = [];

    while (!this.atEnd()) {
      const character = this.current();
      if (character === '{') {
        elements.push(this.parseArgument(expectingCloseTag));
      } else if (character === '}' && nested) {
        break;
      } else if (character === '#' && inPlural) {
        const start = this.index;
        this.index += 1;
        elements.push(
          this.withLocation({ type: TYPE.pound }, start, this.index)
        );
      } else if (
        character === '<' &&
        !this.options.ignoreTag &&
        this.peek() === '/'
      ) {
        if (expectingCloseTag) break;
        this.fail('UNMATCHED_CLOSING_TAG');
      } else if (
        character === '<' &&
        !this.options.ignoreTag &&
        isAsciiLetter(this.peek())
      ) {
        elements.push(this.parseTag(inPlural));
      } else {
        elements.push(this.parseLiteral(nested, inPlural));
      }
    }

    return elements;
  }

  private parseLiteral(
    nested: boolean,
    inPlural: boolean
  ): MessageFormatElement {
    const start = this.index;
    let value = '';

    while (!this.atEnd()) {
      const quote = this.tryParseQuote(inPlural);
      if (quote !== null) {
        value += quote;
        continue;
      }

      const character = this.current();
      if (
        character === '{' ||
        (character === '}' && nested) ||
        (character === '#' && inPlural) ||
        (character === '<' &&
          !this.options.ignoreTag &&
          (isAsciiLetter(this.peek()) || this.peek() === '/'))
      ) {
        break;
      }

      value += character;
      this.index += character.length;
    }

    return this.withLocation({ type: TYPE.literal, value }, start, this.index);
  }

  private tryParseQuote(inPlural: boolean): string | null {
    if (this.current() !== "'") return null;

    const next = this.peek();
    if (next === "'") {
      this.index += 2;
      return "'";
    }

    if (!'{}<>'.includes(next) && (next !== '#' || !inPlural)) return null;

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

  private parseTag(inPlural: boolean): MessageFormatElement {
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
    const children = this.parseMessage(true, inPlural, true);

    const closingTagStart = this.index;
    if (!this.consume('</')) this.fail('UNCLOSED_TAG', start);
    const closingNameStart = this.index;
    if (!isAsciiLetter(this.current())) {
      this.failAt('INVALID_TAG', closingTagStart, this.index);
    }
    const closingTag = this.readTagName();
    if (closingTag !== tagName) {
      this.fail('UNMATCHED_CLOSING_TAG', closingNameStart);
    }
    this.skipSpace();
    if (!this.consume('>')) {
      this.failAt('INVALID_TAG', closingTagStart, this.index);
    }

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
    while (!this.atEnd() && isTagNameCharacter(this.current())) {
      this.index += this.current().length;
    }
    return this.message.slice(start, this.index);
  }

  private parseArgument(expectingCloseTag: boolean): MessageFormatElement {
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
    if (this.atEnd()) this.fail('EXPECT_ARGUMENT_CLOSING_BRACE', start);

    const argumentTypeStart = this.index;
    const argumentType = this.readIdentifier();
    const argumentTypeEnd = this.index;
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
          argumentTypeEnd,
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
    let rawStyle: string | undefined;
    let styleStart = 0;
    let styleEnd = 0;

    if (this.consume(',')) {
      this.skipSpace();
      styleStart = this.index;
      rawStyle = this.readSimpleStyle().replace(/\s+$/u, '');
      if (!rawStyle) this.fail('EXPECT_ARGUMENT_STYLE');
      styleEnd = this.index;
    }

    if (!this.consume('}')) {
      this.fail('EXPECT_ARGUMENT_CLOSING_BRACE', start);
    }

    if (rawStyle) {
      if (rawStyle.slice(0, 2) === '::') {
        const skeleton = rawStyle.slice(2).replace(/^\s+/u, '');
        const styleLocation = this.location(styleStart, styleEnd);
        if (argumentType === 'number') {
          let tokens: ReturnType<typeof parseNumberSkeletonTokens>;
          try {
            tokens = parseNumberSkeletonTokens(skeleton);
          } catch {
            this.failAt('INVALID_NUMBER_SKELETON', styleStart, styleEnd);
          }
          style = {
            type: SKELETON_TYPE.number,
            tokens,
            ...(styleLocation ? { location: styleLocation } : {}),
            parsedOptions: this.options.shouldParseSkeletons
              ? parseNumberSkeletonOptions(tokens)
              : {},
          };
        } else {
          if (!skeleton) {
            this.failAt('EXPECT_DATE_TIME_SKELETON', start, this.index);
          }
          const pattern = resolveLocaleHourSkeleton(
            skeleton,
            this.options.locale
          );
          style = {
            type: SKELETON_TYPE.dateTime,
            pattern,
            ...(styleLocation ? { location: styleLocation } : {}),
            parsedOptions: this.options.shouldParseSkeletons
              ? parseDateTimeSkeletonOptions(pattern)
              : {},
          };
        }
      } else {
        style = rawStyle;
      }
    }

    const type =
      argumentType === 'number'
        ? TYPE.number
        : argumentType === 'date'
          ? TYPE.date
          : TYPE.time;
    return this.withLocation(
      { type, value, style } as MessageFormatElement,
      start,
      this.index
    );
  }

  private readSimpleStyle(): string {
    const start = this.index;

    while (!this.atEnd()) {
      const character = this.current();
      if (character === "'") {
        this.index += 1;
        const quotedContentStart = this.index;
        while (!this.atEnd() && this.current() !== "'") {
          this.index += this.current().length;
        }
        if (this.atEnd()) {
          this.fail('UNCLOSED_QUOTE_IN_ARGUMENT_STYLE', quotedContentStart);
        }
        this.index += 1;
      } else if (character === '}') {
        // intl-messageformat 10.7.16's pinned parser terminates argument
        // styles at the first unquoted `}`, even after an opening `{`. The
        // upstream scanner intended to balance braces but did not advance
        // after decrementing its nesting counter, so the same `}` was visited
        // until it ended the style. Preserve that observable bug because it
        // determines trailing AST elements and existing GT translation hashes.
        // This intentionally differs from ICU's matched-brace argStyleText
        // grammar.
        break;
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
    argumentTypeEnd: number,
    expectingCloseTag: boolean
  ): MessageFormatElement {
    this.skipSpace();
    if (!this.consume(',')) {
      this.failAt(
        'EXPECT_SELECT_ARGUMENT_OPTIONS',
        argumentTypeEnd,
        argumentTypeEnd
      );
    }
    this.skipSpace();

    let offset = 0;
    const firstSelectorStart = this.index;
    let selector = this.readIdentifier();
    if (argumentType !== 'select' && selector === 'offset') {
      if (!this.consume(':')) this.fail('EXPECT_PLURAL_ARGUMENT_OFFSET_VALUE');
      this.skipSpace();
      offset = Number(
        this.readIntegerToken(
          'EXPECT_PLURAL_ARGUMENT_OFFSET_VALUE',
          'INVALID_PLURAL_ARGUMENT_OFFSET_VALUE'
        )
      );
      this.skipSpace();
      selector = this.readIdentifier();
    }

    const options: Record<string, PluralOrSelectOption> = Object.create(null);
    let selectorStart = firstSelectorStart;

    while (selector || (argumentType !== 'select' && this.current() === '=')) {
      if (!selector && this.consume('=')) {
        // Exact plural selectors compare against the raw input value before
        // numeric coercion. Preserve the source token so `=01`, `=+1`, and
        // `=-0` remain observably distinct from their canonical spellings,
        // matching FormatJS parsing and runtime behavior.
        selector = `=${this.readIntegerToken(
          'EXPECT_PLURAL_ARGUMENT_SELECTOR',
          'INVALID_PLURAL_ARGUMENT_SELECTOR'
        )}`;
      }
      if (selector in options) {
        this.failAt(
          argumentType === 'select'
            ? 'DUPLICATE_SELECT_ARGUMENT_SELECTOR'
            : 'DUPLICATE_PLURAL_ARGUMENT_SELECTOR',
          selectorStart,
          this.index
        );
      }

      this.skipSpace();
      const optionStart = this.index;
      if (!this.consume('{')) {
        this.fail(
          argumentType === 'select'
            ? 'EXPECT_SELECT_ARGUMENT_SELECTOR_FRAGMENT'
            : 'EXPECT_PLURAL_ARGUMENT_SELECTOR_FRAGMENT'
        );
      }
      const optionValue = this.parseMessage(
        true,
        argumentType !== 'select',
        expectingCloseTag
      );
      if (!this.consume('}')) {
        this.fail('EXPECT_ARGUMENT_CLOSING_BRACE', optionStart);
      }
      const optionLocation = this.location(optionStart, this.index);
      options[selector] = {
        value: optionValue,
        ...(optionLocation ? { location: optionLocation } : {}),
      };

      this.skipSpace();
      selectorStart = this.index;
      selector = this.readIdentifier();
    }

    if (Object.keys(options).length === 0) {
      this.fail(
        argumentType === 'select'
          ? 'EXPECT_SELECT_ARGUMENT_SELECTOR'
          : 'EXPECT_PLURAL_ARGUMENT_SELECTOR'
      );
    }
    if (this.options.requiresOtherClause && !('other' in options)) {
      this.fail('MISSING_OTHER_CLAUSE', selectorStart);
    }
    if (!this.consume('}')) this.fail('EXPECT_ARGUMENT_CLOSING_BRACE', start);
    Object.setPrototypeOf(options, Object.prototype);

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

  private readIntegerToken(
    expectedErrorCode: string,
    invalidErrorCode: string
  ): string {
    const start = this.index;
    if (this.current() === '+' || this.current() === '-') this.index += 1;
    const digitStart = this.index;
    while (/\d/u.test(this.current())) this.index += 1;
    if (digitStart === this.index) this.fail(expectedErrorCode, start);
    const token = this.message.slice(start, this.index);
    if (Math.abs(Number(token)) > 0x1fffffffffffff) {
      this.fail(invalidErrorCode, start);
    }
    return token;
  }

  private readIdentifier(): string {
    const start = this.index;
    while (!this.atEnd() && !IDENTIFIER_BOUNDARY.test(this.current())) {
      this.index += this.current().length;
    }
    return this.message.slice(start, this.index);
  }

  private skipSpace(): void {
    while (!this.atEnd() && GRAMMAR_WHITE_SPACE.test(this.current())) {
      this.index += this.current().length;
    }
  }

  private consume(value: string): boolean {
    if (this.message.slice(this.index, this.index + value.length) !== value) {
      return false;
    }
    this.index += value.length;
    return true;
  }

  private current(): string {
    return characterAt(this.message, this.index);
  }

  private peek(): string {
    const current = this.current();
    return characterAt(this.message, this.index + current.length);
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
    if (!this.options.captureLocation) return undefined;
    return { start: this.position(start), end: this.position(end) };
  }

  private position(offset: number): LocationDetails {
    const positions = (this.positions ??= buildPositionIndex(this.message));
    return {
      offset,
      line: positions[0][offset],
      column: positions[1][offset],
    };
  }

  private fail(code: string, offset = this.index): never {
    return this.failAt(code, offset, Math.max(offset, this.index));
  }

  private failAt(code: string, start: number, end: number): never {
    const error = new SyntaxError(code) as SyntaxError & {
      location: Location;
      originalMessage: string;
    };
    error.location = {
      start: this.position(start),
      end: this.position(end),
    };
    error.originalMessage = this.message;
    throw error;
  }
}

function buildPositionIndex(message: string): PositionIndex {
  const lines = new Uint32Array(message.length + 1);
  const columns = new Uint32Array(message.length + 1);
  let offset = 0;
  let line = 1;
  let column = 1;

  while (offset < message.length) {
    const character = characterAt(message, offset);
    lines[offset] = line;
    columns[offset] = column;
    if (character.length === 2) {
      lines[offset + 1] = line;
      columns[offset + 1] = column + 1;
    }
    offset += character.length;
    if (character === '\n') {
      line += 1;
      column = 1;
    } else {
      column += 1;
    }
  }

  lines[offset] = line;
  columns[offset] = column;
  return [lines, columns];
}

function characterAt(value: string, index: number): string {
  if (index >= value.length) return '\0';
  const first = value.charCodeAt(index);
  if (first < 0xd800 || first > 0xdbff || index + 1 >= value.length) {
    return value.charAt(index);
  }
  const second = value.charCodeAt(index + 1);
  return second >= 0xdc00 && second <= 0xdfff
    ? value.slice(index, index + 2)
    : value.charAt(index);
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
