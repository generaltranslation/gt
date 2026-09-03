import type { FileFormat } from 'generaltranslation/types';

/**
 * On-disk byte layouts Foundation accepts for `.strings` and `.stringsdict`.
 *
 * A byte order mark is the only signal. Foundation does not sniff UTF-16 from
 * interleaved NUL bytes, so an unmarked file is UTF-8 even when its bytes are
 * plainly UTF-16 — `plutil` rejects those files, and guessing would translate
 * content Foundation itself cannot read.
 */
export type AppleTextEncoding =
  | 'utf8'
  | 'utf8-bom'
  | 'utf16le'
  | 'utf16be'
  | 'utf32le'
  | 'utf32be';

const APPLE_TEXT_FILE_FORMATS: ReadonlySet<FileFormat> = new Set<FileFormat>([
  'DOT_STRINGS',
  'DOT_STRINGSDICT',
]);

/**
 * Whether a format's bytes on disk may carry an encoding other than UTF-8, so
 * reads must decode by byte order mark and writes must restore it.
 */
export function isAppleTextFileFormat(fileFormat: FileFormat): boolean {
  return APPLE_TEXT_FILE_FORMATS.has(fileFormat);
}

const BYTE_ORDER_MARKS = [
  // UTF-32LE is checked before UTF-16LE because its mark begins with the same
  // two bytes; the reverse order silently decodes UTF-32 as NUL-padded UTF-16.
  ['utf32le', [0xff, 0xfe, 0x00, 0x00]],
  ['utf32be', [0x00, 0x00, 0xfe, 0xff]],
  ['utf16le', [0xff, 0xfe]],
  ['utf16be', [0xfe, 0xff]],
  ['utf8-bom', [0xef, 0xbb, 0xbf]],
] as const satisfies ReadonlyArray<readonly [AppleTextEncoding, number[]]>;

const BYTE_ORDER_MARK_BY_ENCODING = new Map<AppleTextEncoding, Buffer>(
  BYTE_ORDER_MARKS.map(([encoding, mark]) => [encoding, Buffer.from(mark)])
);

/** Bytes that must be in hand before a byte order mark can be ruled out. */
export const LONGEST_BYTE_ORDER_MARK = Math.max(
  ...BYTE_ORDER_MARKS.map(([, mark]) => mark.length)
);

/** Reads the byte order mark, defaulting to UTF-8 when there is none. */
export function detectAppleTextEncoding(bytes: Buffer): AppleTextEncoding {
  for (const [encoding, mark] of BYTE_ORDER_MARKS) {
    if (bytes.length >= mark.length && mark.every((b, i) => bytes[i] === b)) {
      return encoding;
    }
  }
  return 'utf8';
}

/**
 * Decodes a `.strings` or `.stringsdict` file to text, dropping the byte order
 * mark. The encoding is returned so the writer can restore both on the way out.
 */
export function decodeAppleText(bytes: Buffer): {
  text: string;
  encoding: AppleTextEncoding;
} {
  const encoding = detectAppleTextEncoding(bytes);
  const body = bytes.subarray(
    BYTE_ORDER_MARK_BY_ENCODING.get(encoding)?.length ?? 0
  );

  switch (encoding) {
    case 'utf16le':
      return { text: decodeUtf16(body, true), encoding };
    case 'utf16be':
      return { text: decodeUtf16(body, false), encoding };
    case 'utf32le':
      return { text: decodeUtf32(body, true), encoding };
    case 'utf32be':
      return { text: decodeUtf32(body, false), encoding };
    default:
      return { text: body.toString('utf8'), encoding };
  }
}

/** Re-encodes text into the given layout, byte order mark included. */
export function encodeAppleText(
  text: string,
  encoding: AppleTextEncoding
): Buffer {
  const mark = BYTE_ORDER_MARK_BY_ENCODING.get(encoding);
  const body = (() => {
    switch (encoding) {
      case 'utf16le':
        return Buffer.from(text, 'utf16le');
      case 'utf16be':
        return Buffer.from(text, 'utf16le').swap16();
      case 'utf32le':
        return encodeUtf32(text, true);
      case 'utf32be':
        return encodeUtf32(text, false);
      default:
        return Buffer.from(text, 'utf8');
    }
  })();
  return mark ? Buffer.concat([mark, body]) : body;
}

function decodeUtf16(body: Buffer, littleEndian: boolean): string {
  if (body.length % 2 !== 0) {
    throw new Error(
      'the file has a UTF-16 byte order mark but an odd number of bytes'
    );
  }
  if (littleEndian) return body.toString('utf16le');
  // swap16 reorders in place, so copy rather than mutating the caller's bytes.
  return Buffer.from(body).swap16().toString('utf16le');
}

// String.fromCodePoint takes code points as arguments, so a whole file spread
// in one call can overflow the stack.
const CODE_POINTS_PER_CALL = 4096;

function decodeUtf32(body: Buffer, littleEndian: boolean): string {
  if (body.length % 4 !== 0) {
    throw new Error(
      'the file has a UTF-32 byte order mark but its length is not a multiple of four bytes'
    );
  }
  const codePoints = new Array<number>(body.length / 4);
  for (let i = 0; i < body.length; i += 4) {
    codePoints[i / 4] = littleEndian
      ? body.readUInt32LE(i)
      : body.readUInt32BE(i);
  }
  let text = '';
  for (let i = 0; i < codePoints.length; i += CODE_POINTS_PER_CALL) {
    try {
      text += String.fromCodePoint(
        ...codePoints.slice(i, i + CODE_POINTS_PER_CALL)
      );
    } catch {
      throw new Error(
        'the file has a UTF-32 byte order mark but contains a value that is not a Unicode code point'
      );
    }
  }
  return text;
}

function encodeUtf32(text: string, littleEndian: boolean): Buffer {
  // Iterating a string yields whole code points, so surrogate pairs stay intact.
  const characters = Array.from(text);
  const body = Buffer.alloc(characters.length * 4);
  characters.forEach((character, index) => {
    const codePoint = character.codePointAt(0) ?? 0;
    if (littleEndian) body.writeUInt32LE(codePoint, index * 4);
    else body.writeUInt32BE(codePoint, index * 4);
  });
  return body;
}
