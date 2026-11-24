import fsp from 'node:fs/promises';

export type JsonObject = { [key: string]: unknown };

export function isJsonObject(value: unknown): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** The object `text` is the JSON of; undefined if it is invalid or anything else. */
export function parseJsonObject(text: string): JsonObject | undefined {
  try {
    const value: unknown = JSON.parse(text);
    return isJsonObject(value) ? value : undefined;
  } catch {
    return undefined;
  }
}

/** The object in a JSON file; undefined if the file is missing or holds anything else. */
export async function readJsonObject(
  file: string
): Promise<JsonObject | undefined> {
  const text = await fsp.readFile(file, 'utf8').catch(() => undefined);
  if (text === undefined) return undefined;

  return parseJsonObject(text);
}

/** `valueAtPath({ nav: { home: 1 } }, ["nav", "home"])` → `1`; undefined if nothing is there. */
export function valueAtPath(
  root: JsonObject,
  keyPath: readonly string[]
): unknown {
  let value: unknown = root;

  for (const key of keyPath) {
    if (!isJsonObject(value) || !Object.hasOwn(value, key)) return undefined;

    value = value[key];
  }

  return value;
}

/** Sets the value at `keyPath`, creating the objects on the way that are missing. */
export function setAtPath(
  root: JsonObject,
  keyPath: readonly string[],
  value: unknown
): void {
  const parentKeys = keyPath.slice(0, -1);
  const lastKey = keyPath.at(-1);
  if (lastKey === undefined) return;

  let parent = root;

  for (const key of parentKeys) {
    const child = Object.hasOwn(parent, key) ? parent[key] : undefined;
    const next = isJsonObject(child) ? child : {};
    setOwnProperty(parent, key, next);
    parent = next;
  }

  setOwnProperty(parent, lastKey, value);
}

/** Assigning the key `__proto__` would change the object's prototype instead. */
function setOwnProperty(object: JsonObject, key: string, value: unknown): void {
  Object.defineProperty(object, key, {
    value,
    writable: true,
    enumerable: true,
    configurable: true,
  });
}

const INDENT = '  ';

/**
 * A value that writes its own JSON, as `JSON.stringify(value, null, 2)` would
 * at `indent`: for values too large to hold as objects, e.g. kept as bytes.
 */
export class StreamedJson {
  constructor(readonly chunks: (indent: string) => Iterable<string | Buffer>) {}
}

/** Bytes of JSON parsed at once; longer objects and arrays are parsed member by member. */
const MAX_PARSED_BYTES = 64 * 1024 * 1024;

/**
 * The text of `JSON.stringify(value, null, 2)` for plain JSON data and
 * `StreamedJson`, in pieces: the JSON of a large project's metadata is longer
 * than the longest string V8 holds.
 */
export function* jsonChunks(value: unknown): Generator<string | Buffer> {
  yield* valueChunks(value, '');
}

function* valueChunks(
  value: unknown,
  indent: string
): Generator<string | Buffer> {
  if (value instanceof StreamedJson) {
    yield* value.chunks(indent);
    return;
  }

  if (typeof value !== 'object' || value === null) {
    yield JSON.stringify(value);
    return;
  }

  const inner = indent + INDENT;

  if (Array.isArray(value)) {
    if (value.length === 0) {
      yield '[]';
      return;
    }

    for (let index = 0; index < value.length; index++) {
      yield index === 0 ? `[\n${inner}` : `,\n${inner}`;

      const item: unknown = value[index];
      if (isOmitted(item)) yield 'null';
      else yield* valueChunks(item, inner);
    }

    yield `\n${indent}]`;
    return;
  }

  const entries = Object.entries(value).filter(
    ([, member]) => !isOmitted(member)
  );
  if (entries.length === 0) {
    yield '{}';
    return;
  }

  for (const [index, [key, member]] of entries.entries()) {
    yield `${index === 0 ? '{' : ','}\n${inner}${JSON.stringify(key)}: `;
    yield* valueChunks(member, inner);
  }

  yield `\n${indent}}`;
}

/** What `JSON.stringify` leaves out of an object, and writes as `null` in an array. */
function isOmitted(value: unknown): boolean {
  return (
    value === undefined ||
    typeof value === 'function' ||
    typeof value === 'symbol'
  );
}

/**
 * The object the JSON in `bytes` is, as `parseJsonObject` gives it. JSON
 * longer than the longest string V8 holds is parsed member by member, and the
 * members of objects too long to parse at once whose key path `omits` is true
 * for are checked but left out. Nothing in an array is left out.
 */
export function parseJsonBytes(
  bytes: Buffer,
  omits: (keyPath: readonly string[]) => boolean,
  maxParsedBytes = MAX_PARSED_BYTES
): JsonObject | undefined {
  if (bytes.length <= maxParsedBytes) {
    return parseJsonObject(bytes.toString('utf8'));
  }

  try {
    const parser = new JsonBytesParser(bytes, omits, maxParsedBytes);
    const value = parser.parseDocument();
    return isJsonObject(value) ? value : undefined;
  } catch {
    return undefined;
  }
}

const QUOTE = 0x22;
const BACKSLASH = 0x5c;
const COMMA = 0x2c;
const COLON = 0x3a;
const OPEN_OBJECT = 0x7b;
const CLOSE_OBJECT = 0x7d;
const OPEN_ARRAY = 0x5b;
const CLOSE_ARRAY = 0x5d;

/** Splits objects and arrays into members until each is short enough for `JSON.parse`. Throws on invalid JSON. */
class JsonBytesParser {
  constructor(
    private readonly bytes: Buffer,
    private readonly omits: (keyPath: readonly string[]) => boolean,
    private readonly maxParsedBytes: number
  ) {}

  parseDocument(): unknown {
    const start = this.skipWhitespace(0);
    const end = this.valueEnd(start);
    if (this.skipWhitespace(end) !== this.bytes.length) {
      throw new SyntaxError('Unexpected data after JSON');
    }

    return this.parse(start, end, []);
  }

  /** `keyPath` is undefined in an array. A value that is not kept is only checked, a piece at a time. */
  private parse(
    start: number,
    end: number,
    keyPath: readonly string[] | undefined,
    keep = true
  ): unknown {
    if (end - start <= this.maxParsedBytes) {
      return JSON.parse(this.bytes.toString('utf8', start, end));
    }

    switch (this.bytes[start]) {
      case OPEN_OBJECT:
        return this.parseObject(start, end, keyPath, keep);
      case OPEN_ARRAY:
        return this.parseArray(start, end, keep);
      default:
        return JSON.parse(this.bytes.toString('utf8', start, end));
    }
  }

  private parseObject(
    start: number,
    end: number,
    keyPath: readonly string[] | undefined,
    keep: boolean
  ): JsonObject {
    const object: JsonObject = {};
    let position = this.skipWhitespace(start + 1);
    if (this.bytes[position] === CLOSE_OBJECT)
      return this.closed(object, position, end);

    for (;;) {
      if (this.bytes[position] !== QUOTE)
        throw new SyntaxError('Expected a key');

      const keyEnd = this.stringEnd(position);
      const key = JSON.parse(
        this.bytes.toString('utf8', position, keyEnd)
      ) as string;

      position = this.skipWhitespace(keyEnd);
      if (this.bytes[position] !== COLON) throw new SyntaxError('Expected ":"');

      const valueStart = this.skipWhitespace(position + 1);
      const valueEnd = this.valueEnd(valueStart);
      const memberPath = keyPath && [...keyPath, key];
      const isKept = keep && !(memberPath && this.omits(memberPath));
      const value = this.parse(valueStart, valueEnd, memberPath, isKept);
      if (isKept) {
        Object.defineProperty(object, key, {
          value,
          writable: true,
          enumerable: true,
          configurable: true,
        });
      }

      position = this.skipWhitespace(valueEnd);
      if (this.bytes[position] === CLOSE_OBJECT)
        return this.closed(object, position, end);
      if (this.bytes[position] !== COMMA)
        throw new SyntaxError('Expected "," or "}"');
      position = this.skipWhitespace(position + 1);
    }
  }

  private parseArray(start: number, end: number, keep: boolean): unknown[] {
    const array: unknown[] = [];
    let position = this.skipWhitespace(start + 1);
    if (this.bytes[position] === CLOSE_ARRAY)
      return this.closed(array, position, end);

    for (;;) {
      const valueEnd = this.valueEnd(position);
      const value = this.parse(position, valueEnd, undefined, keep);
      if (keep) array.push(value);

      position = this.skipWhitespace(valueEnd);
      if (this.bytes[position] === CLOSE_ARRAY)
        return this.closed(array, position, end);
      if (this.bytes[position] !== COMMA)
        throw new SyntaxError('Expected "," or "]"');
      position = this.skipWhitespace(position + 1);
    }
  }

  private closed<T>(value: T, position: number, end: number): T {
    if (position + 1 !== end) throw new SyntaxError('Unexpected end of value');
    return value;
  }

  /** The position after the value at `start`. */
  private valueEnd(start: number): number {
    const first = this.bytes[start];
    if (first === QUOTE) return this.stringEnd(start);
    if (first !== OPEN_OBJECT && first !== OPEN_ARRAY)
      return this.literalEnd(start);

    let depth = 0;

    for (let position = start; position < this.bytes.length; position++) {
      const byte = this.bytes[position];

      if (byte === QUOTE) {
        position = this.stringEnd(position) - 1;
      } else if (byte === OPEN_OBJECT || byte === OPEN_ARRAY) {
        depth++;
      } else if (byte === CLOSE_OBJECT || byte === CLOSE_ARRAY) {
        depth--;
        if (depth === 0) return position + 1;
      }
    }

    throw new SyntaxError('Unterminated value');
  }

  /** The position after the string whose opening quote is at `start`. */
  private stringEnd(start: number): number {
    for (let position = start + 1; position < this.bytes.length; position++) {
      const byte = this.bytes[position];
      if (byte === BACKSLASH) position++;
      else if (byte === QUOTE) return position + 1;
    }

    throw new SyntaxError('Unterminated string');
  }

  /** A number, `true`, `false` or `null` ends where a separator or whitespace starts. */
  private literalEnd(start: number): number {
    let position = start;

    while (
      position < this.bytes.length &&
      !isSeparator(this.bytes[position]!)
    ) {
      position++;
    }

    if (position === start) throw new SyntaxError('Expected a value');
    return position;
  }

  private skipWhitespace(start: number): number {
    let position = start;
    while (
      position < this.bytes.length &&
      isWhitespace(this.bytes[position]!)
    ) {
      position++;
    }

    return position;
  }
}

function isWhitespace(byte: number): boolean {
  return byte === 0x20 || byte === 0x09 || byte === 0x0a || byte === 0x0d;
}

function isSeparator(byte: number): boolean {
  return (
    isWhitespace(byte) ||
    byte === COMMA ||
    byte === CLOSE_OBJECT ||
    byte === CLOSE_ARRAY
  );
}
