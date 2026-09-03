import fs from 'node:fs';
import { isBinaryFileFormat, type FileFormat } from 'generaltranslation/types';

/**
 * How file content crosses the disk boundary.
 *
 * This is the only module in the CLI that knows a file may be stored in
 * something other than UTF-8. `readFileContent` is the single ingress point and
 * `encodeFileContent` the single egress point; in between, content is a UTF-8
 * string and nothing else has to reason about encodings.
 */

/**
 * On-disk byte layouts Foundation accepts for `.strings` and `.stringsdict`.
 *
 * A byte order mark is the only signal. Foundation does not sniff UTF-16 from
 * interleaved NUL bytes, so an unmarked file is UTF-8 even when its bytes are
 * plainly UTF-16 — `plutil` rejects those files, and guessing would translate
 * content Foundation itself cannot read.
 */
export type FileEncoding =
  | 'utf8'
  | 'utf8-bom'
  | 'utf16le'
  | 'utf16be'
  | 'utf32le'
  | 'utf32be';

/**
 * Formats whose bytes on disk may carry an encoding other than UTF-8, so reads
 * decode by byte order mark and writes restore it. Older Xcode wrote both of
 * Apple's localization formats as UTF-16.
 */
const BYTE_ORDER_MARK_FORMATS: ReadonlySet<FileFormat> = new Set<FileFormat>([
  'DOT_STRINGS',
  'DOT_STRINGSDICT',
]);

/**
 * Ingress. Reads a file as the content the pipeline carries for its format:
 * base64 for binary formats, otherwise UTF-8 text decoded from whatever
 * encoding the file happens to be stored in.
 * @param {string} filePath - The path to the file to read.
 * @param {FileFormat} fileFormat - The format the file is configured as.
 * @returns {string} - The content, or '' if the file is absent.
 */
export function readFileContent(
  filePath: string,
  fileFormat: FileFormat
): string {
  if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) return '';
  if (isBinaryFileFormat(fileFormat)) {
    return fs.readFileSync(filePath).toString('base64');
  }
  if (BYTE_ORDER_MARK_FORMATS.has(fileFormat)) {
    return decodeFileText(fs.readFileSync(filePath)).text;
  }
  return fs.readFileSync(filePath, 'utf8');
}

/**
 * Egress. Renders translated content for disk in the encoding `sourcePath` is
 * stored in, so a repository of UTF-16 files stays UTF-16 rather than showing
 * every one of them as rewritten.
 *
 * The source file is the record of that encoding, which is why it is re-read
 * here rather than carried from ingress: the download that writes this file is
 * usually a different process run from the upload that read it, so there is no
 * value to carry. Nothing has to be persisted in the lockfile or on the server.
 *
 * A source moved or deleted since it was uploaded leaves the translation
 * already on disk as the only remaining record, so `outputPath` is read next.
 * Defaulting straight to UTF-8 would rewrite every UTF-16 file and, for
 * `.stringsdict`, strand a UTF-16 XML declaration over unmarked UTF-8 bytes —
 * the one combination Foundation rejects.
 * @param {string} content - The translated content, as UTF-8 text.
 * @param {FileFormat} fileFormat - The format being written.
 * @param {string} sourcePath - The source file this translation came from.
 * @param {string} [outputPath] - Where the translation is about to be written.
 * @returns The value to hand to `writeFile`.
 */
export function encodeFileContent(
  content: string,
  fileFormat: FileFormat | undefined,
  sourcePath: string,
  outputPath?: string
): string | Buffer {
  if (!fileFormat || !BYTE_ORDER_MARK_FORMATS.has(fileFormat)) return content;
  const encoding =
    readFileEncoding(sourcePath) ??
    (outputPath ? readFileEncoding(outputPath) : undefined) ??
    'utf8';
  return encoding === 'utf8' ? content : encodeFileText(content, encoding);
}

/**
 * Reads a file's byte order mark without reading the rest of it. Undefined
 * separates "no such file" from a file that is genuinely unmarked UTF-8.
 */
function readFileEncoding(filePath: string): FileEncoding | undefined {
  if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
    return undefined;
  }
  const handle = fs.openSync(filePath, 'r');
  try {
    const mark = Buffer.alloc(LONGEST_BYTE_ORDER_MARK);
    const read = fs.readSync(handle, mark, 0, mark.length, 0);
    return detectFileEncoding(mark.subarray(0, read));
  } finally {
    fs.closeSync(handle);
  }
}

const BYTE_ORDER_MARKS = [
  // UTF-32LE is checked before UTF-16LE because its mark begins with the same
  // two bytes; the reverse order silently decodes UTF-32 as NUL-padded UTF-16.
  ['utf32le', [0xff, 0xfe, 0x00, 0x00]],
  ['utf32be', [0x00, 0x00, 0xfe, 0xff]],
  ['utf16le', [0xff, 0xfe]],
  ['utf16be', [0xfe, 0xff]],
  ['utf8-bom', [0xef, 0xbb, 0xbf]],
] as const satisfies ReadonlyArray<readonly [FileEncoding, number[]]>;

const BYTE_ORDER_MARK_BY_ENCODING = new Map<FileEncoding, Buffer>(
  BYTE_ORDER_MARKS.map(([encoding, mark]) => [encoding, Buffer.from(mark)])
);

/** Bytes that must be in hand before a byte order mark can be ruled out. */
const LONGEST_BYTE_ORDER_MARK = Math.max(
  ...BYTE_ORDER_MARKS.map(([, mark]) => mark.length)
);

/** Reads the byte order mark, defaulting to UTF-8 when there is none. */
export function detectFileEncoding(bytes: Buffer): FileEncoding {
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
export function decodeFileText(bytes: Buffer): {
  text: string;
  encoding: FileEncoding;
} {
  const encoding = detectFileEncoding(bytes);
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
export function encodeFileText(text: string, encoding: FileEncoding): Buffer {
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
      'it has a UTF-16 byte order mark but an odd number of bytes. Re-save it as UTF-8, or as complete UTF-16'
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
      'it has a UTF-32 byte order mark but its length is not a multiple of four bytes. Re-save it as UTF-8, or as complete UTF-32'
    );
  }
  const codePoints = Array.from({ length: body.length / 4 }, (_, i) =>
    littleEndian ? body.readUInt32LE(i * 4) : body.readUInt32BE(i * 4)
  );
  let text = '';
  for (let i = 0; i < codePoints.length; i += CODE_POINTS_PER_CALL) {
    try {
      text += String.fromCodePoint(
        ...codePoints.slice(i, i + CODE_POINTS_PER_CALL)
      );
    } catch {
      throw new Error(
        'it has a UTF-32 byte order mark but contains a value that is not a Unicode code point'
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
