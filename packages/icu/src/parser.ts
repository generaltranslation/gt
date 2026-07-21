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

// FormatJS distinguishes ICU grammar whitespace (Pattern_White_Space) from
// the broader Unicode whitespace set used to terminate identifiers. Keeping
// these separate matters for named styles such as `\u00A0percent`.
const GRAMMAR_WHITE_SPACE = /[\t-\r \x85\u200E\u200F\u2028\u2029]/u;
// Explicit Unicode White_Space + Pattern_Syntax ranges avoid a module-load
// syntax error in engines that support `u` regexes but not property escapes.
const IDENTIFIER_BOUNDARY =
  /[\t-\r \x85\xA0\u1680\u2000-\u200A\u2028\u2029\u202F\u205F\u3000\x21-\x2F\x3A-\x40\x5B-\x5E\x60\x7B-\x7E\xA1-\xA7\xA9\xAB\xAC\xAE\xB0\xB1\xB6\xBB\xBF\xD7\xF7\u2010-\u2027\u2030-\u203E\u2041-\u2053\u2055-\u205E\u2190-\u245F\u2500-\u2775\u2794-\u2BFF\u2E00-\u2E7F\u3001-\u3003\u3008-\u3020\u3030\uFD3E-\uFD3F\uFE45-\uFE46]/u;

type PositionIndex = {
  lines: Uint32Array;
  columns: Uint32Array;
};

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

    const quotesSyntax =
      next === '{' ||
      next === '}' ||
      next === '<' ||
      next === '>' ||
      (next === '#' && inPlural);
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
    let styleSource:
      | { rawStyle: string; start: number; end: number }
      | undefined;

    if (this.consume(',')) {
      this.skipSpace();
      const styleStart = this.index;
      const rawStyle = trimEnd(this.readSimpleStyle());
      if (!rawStyle) this.fail('EXPECT_ARGUMENT_STYLE');
      styleSource = { rawStyle, start: styleStart, end: this.index };
    }

    if (!this.consume('}')) {
      this.fail('EXPECT_ARGUMENT_CLOSING_BRACE', start);
    }

    if (styleSource) {
      const { rawStyle, start: styleStart, end: styleEnd } = styleSource;
      if (rawStyle.slice(0, 2) === '::') {
        const skeleton = trimStart(rawStyle.slice(2));
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

    const type = {
      number: TYPE.number,
      date: TYPE.date,
      time: TYPE.time,
    }[argumentType];
    return this.withLocation(
      { type, value, style } as MessageFormatElement,
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
        const quotedContentStart = this.index;
        while (!this.atEnd() && this.current() !== "'") {
          this.index += this.current().length;
        }
        if (this.atEnd()) {
          this.fail('UNCLOSED_QUOTE_IN_ARGUMENT_STYLE', quotedContentStart);
        }
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
      offset = this.readInteger(
        'EXPECT_PLURAL_ARGUMENT_OFFSET_VALUE',
        'INVALID_PLURAL_ARGUMENT_OFFSET_VALUE'
      );
      this.skipSpace();
      selector = this.readIdentifier();
    }

    const entries: Array<[string, PluralOrSelectOption]> = [];
    const seen = new Set<string>();
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
      if (seen.has(selector)) {
        this.failAt(
          argumentType === 'select'
            ? 'DUPLICATE_SELECT_ARGUMENT_SELECTOR'
            : 'DUPLICATE_PLURAL_ARGUMENT_SELECTOR',
          selectorStart,
          this.index
        );
      }
      seen.add(selector);

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

    if (entries.length === 0) {
      this.fail(
        argumentType === 'select'
          ? 'EXPECT_SELECT_ARGUMENT_SELECTOR'
          : 'EXPECT_PLURAL_ARGUMENT_SELECTOR'
      );
    }
    if (
      this.options.requiresOtherClause &&
      !entries.some(([entrySelector]) => entrySelector === 'other')
    ) {
      this.fail('MISSING_OTHER_CLAUSE', selectorStart);
    }
    if (!this.consume('}')) this.fail('EXPECT_ARGUMENT_CLOSING_BRACE', start);

    const options = entriesToObject(entries);
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

  private readInteger(
    expectedErrorCode: string,
    invalidErrorCode: string
  ): number {
    return Number(this.readIntegerToken(expectedErrorCode, invalidErrorCode));
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
    const value = Number(token);
    if (!isSafeInteger(value)) this.fail(invalidErrorCode, start);
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
      line: positions.lines[offset],
      column: positions.columns[offset],
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

function entriesToObject<T>(entries: Array<[string, T]>): Record<string, T> {
  const result: Record<string, T> = {};
  for (const [key, value] of entries) {
    // Assignment to __proto__ mutates Object.prototype instead of creating an
    // own key. Object.fromEntries avoided that, and defineProperty preserves
    // the same safe AST shape without requiring the ES2019 API.
    Object.defineProperty(result, key, {
      configurable: true,
      enumerable: true,
      value,
      writable: true,
    });
  }
  return result;
}

function isAsciiLetter(character: string): boolean {
  return /^[A-Za-z]$/u.test(character);
}

/**
 * Matches the PENChar ranges used by FormatJS and the custom-element-name
 * grammar, while allowing ASCII uppercase characters and names without a dash.
 */
function isTagNameCharacter(character: string): boolean {
  const codePoint = codePointValue(character);

  return (
    codePoint === 0x2d ||
    codePoint === 0x2e ||
    (codePoint >= 0x30 && codePoint <= 0x39) ||
    codePoint === 0x5f ||
    (codePoint >= 0x41 && codePoint <= 0x5a) ||
    (codePoint >= 0x61 && codePoint <= 0x7a) ||
    codePoint === 0xb7 ||
    (codePoint >= 0xc0 && codePoint <= 0xd6) ||
    (codePoint >= 0xd8 && codePoint <= 0xf6) ||
    (codePoint >= 0xf8 && codePoint <= 0x37d) ||
    (codePoint >= 0x37f && codePoint <= 0x1fff) ||
    (codePoint >= 0x200c && codePoint <= 0x200d) ||
    (codePoint >= 0x203f && codePoint <= 0x2040) ||
    (codePoint >= 0x2070 && codePoint <= 0x218f) ||
    (codePoint >= 0x2c00 && codePoint <= 0x2fef) ||
    (codePoint >= 0x3001 && codePoint <= 0xd7ff) ||
    (codePoint >= 0xf900 && codePoint <= 0xfdcf) ||
    (codePoint >= 0xfdf0 && codePoint <= 0xfffd) ||
    (codePoint >= 0x10000 && codePoint <= 0xeffff)
  );
}

function buildPositionIndex(message: string): PositionIndex {
  const lines = new Uint32Array(message.length + 1);
  const columns = new Uint32Array(message.length + 1);
  let offset = 0;
  let line = 1;
  let column = 1;

  while (offset < message.length) {
    const character = characterAt(message, offset);
    for (let codeUnit = 0; codeUnit < character.length; codeUnit += 1) {
      lines[offset + codeUnit] = line;
      columns[offset + codeUnit] = column + codeUnit;
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
  return { lines, columns };
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

function codePointValue(character: string): number {
  const first = character.charCodeAt(0);
  if (first >= 0xd800 && first <= 0xdbff && character.length > 1) {
    const second = character.charCodeAt(1);
    if (second >= 0xdc00 && second <= 0xdfff) {
      return (first - 0xd800) * 0x400 + second - 0xdc00 + 0x10000;
    }
  }
  return first;
}

function isSafeInteger(value: number): boolean {
  return (
    Number.isFinite(value) &&
    Math.floor(value) === value &&
    Math.abs(value) <= 0x1fffffffffffff
  );
}

function trimStart(value: string): string {
  return value.replace(/^\s+/u, '');
}

function trimEnd(value: string): string {
  return value.replace(/\s+$/u, '');
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
