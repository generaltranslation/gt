import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  decodeFileText,
  detectFileEncoding,
  encodeFileContent,
  encodeFileText,
  readFileContent,
  type FileEncoding,
} from '../fileContent.js';

// Every buffer here is built from real bytes. The prefixes asserted against
// `detectFileEncoding` were taken verbatim from Foundation-written
// fixtures, so the detector is pinned to layouts Xcode actually produces.

const STRINGS_BODY =
  '/* Localizable.strings */\n' +
  '"app.title" = "Pocket Café";\n' +
  '"welcome" = "¡Bienvenido — te echábamos de menos!";\n' +
  '"celebrate" = "¡Pedido realizado! 🎉";\n';

const STRINGSDICT_BODY =
  '<?xml version="1.0" encoding="UTF-8"?>\n' +
  '<plist version="1.0">\n' +
  '<dict>\n' +
  '\t<key>note.count</key>\n' +
  '\t<dict>\n' +
  '\t\t<key>NSStringLocalizedFormatKey</key>\n' +
  '\t\t<string>%#@n@</string>\n' +
  '\t\t<key>n</key>\n' +
  '\t\t<dict>\n' +
  '\t\t\t<key>NSStringFormatSpecTypeKey</key>\n' +
  '\t\t\t<string>NSStringPluralRuleType</string>\n' +
  '\t\t\t<key>one</key>\n' +
  '\t\t\t<string>%lld observación 🎉</string>\n' +
  '\t\t\t<key>other</key>\n' +
  '\t\t\t<string>%lld observaciones — ¡bien!</string>\n' +
  '\t\t</dict>\n' +
  '\t</dict>\n' +
  '</dict>\n' +
  '</plist>\n';

const ENCODINGS: FileEncoding[] = [
  'utf8',
  'utf8-bom',
  'utf16le',
  'utf16be',
  'utf32le',
  'utf32be',
];

describe('detectFileEncoding', () => {
  // Byte prefixes copied from fixtures written by Foundation.
  it.each([
    ['fffe2f002a0020004600690065006c00', 'utf16le'], // fr.strings
    ['feff003c003f0078006d006c00200076', 'utf16be'], // ru.stringsdict
    ['efbbbf3c3f786d6c2076657273696f6e', 'utf8-bom'], // de.stringsdict
    ['fffe00002f0000002a00000020000000', 'utf32le'], // tr.strings
    ['2f2a204c6f63616c697a61626c65202a', 'utf8'], // en.strings
  ])('reads %s as %s', (hex, expected) => {
    expect(detectFileEncoding(Buffer.from(hex, 'hex'))).toBe(expected);
  });

  // Foundation does not sniff UTF-16 from interleaved NUL bytes: `plutil`
  // rejects these files outright, so guessing would translate content the
  // platform itself cannot read.
  it.each([
    ['2f002a0020004600690065006c006400', 'byte-order-mark-less UTF-16LE'], // es.strings
    ['002f002a0020004600690065006c0064', 'byte-order-mark-less UTF-16BE'], // it.strings
  ])('treats %s (%s) as UTF-8', (hex) => {
    expect(detectFileEncoding(Buffer.from(hex, 'hex'))).toBe('utf8');
  });

  it('does not mistake a UTF-32LE mark for UTF-16LE', () => {
    // FF FE 00 00 begins with the UTF-16LE mark. Checked in the wrong order,
    // a UTF-32 file decodes as NUL-padded UTF-16 without any error.
    const utf32 = encodeFileText('/* a */', 'utf32le');
    expect(detectFileEncoding(utf32)).toBe('utf32le');
    expect(decodeFileText(utf32).text).toBe('/* a */');
  });

  it('does not read a two-byte UTF-16LE mark as a truncated UTF-32 mark', () => {
    expect(detectFileEncoding(Buffer.from([0xff, 0xfe]))).toBe('utf16le');
  });

  it('treats an empty file as UTF-8', () => {
    expect(detectFileEncoding(Buffer.alloc(0))).toBe('utf8');
  });
});

describe('decodeFileText / encodeFileText', () => {
  it.each(ENCODINGS)('round trips a .strings body through %s', (encoding) => {
    const bytes = encodeFileText(STRINGS_BODY, encoding);
    const decoded = decodeFileText(bytes);
    expect(decoded.encoding).toBe(encoding);
    expect(decoded.text).toBe(STRINGS_BODY);
    expect(decoded.text).not.toContain('�');
    // Re-encoding is what the writer does, so it must reproduce the file.
    expect(encodeFileText(decoded.text, decoded.encoding)).toStrictEqual(bytes);
  });

  it.each(ENCODINGS)(
    'round trips a .stringsdict body through %s',
    (encoding) => {
      const bytes = encodeFileText(STRINGSDICT_BODY, encoding);
      const decoded = decodeFileText(bytes);
      expect(decoded.encoding).toBe(encoding);
      expect(decoded.text).toBe(STRINGSDICT_BODY);
      expect(encodeFileText(decoded.text, decoded.encoding)).toStrictEqual(
        bytes
      );
    }
  );

  it('drops the byte order mark so the API only ever sees text', () => {
    for (const encoding of ENCODINGS) {
      const { text } = decodeFileText(encodeFileText(STRINGS_BODY, encoding));
      expect(text.startsWith('﻿')).toBe(false);
      expect(text).toBe(STRINGS_BODY);
    }
  });

  it('writes the byte order mark the source file carried', () => {
    expect(encodeFileText('a', 'utf16le').subarray(0, 2)).toStrictEqual(
      Buffer.from([0xff, 0xfe])
    );
    expect(encodeFileText('a', 'utf16be').subarray(0, 2)).toStrictEqual(
      Buffer.from([0xfe, 0xff])
    );
    expect(encodeFileText('a', 'utf8-bom').subarray(0, 3)).toStrictEqual(
      Buffer.from([0xef, 0xbb, 0xbf])
    );
    // A file with no mark keeps none, so UTF-8 repositories see no churn.
    expect(encodeFileText('a', 'utf8')).toStrictEqual(Buffer.from('a', 'utf8'));
  });

  it('preserves characters outside the basic multilingual plane', () => {
    const body = '"celebrate" = "🎉🇯🇵";\n';
    for (const encoding of ENCODINGS) {
      expect(decodeFileText(encodeFileText(body, encoding)).text).toBe(body);
    }
  });

  it("does not reorder the caller's buffer while decoding UTF-16BE", () => {
    const bytes = encodeFileText(STRINGS_BODY, 'utf16be');
    const before = Buffer.from(bytes);
    decodeFileText(bytes);
    expect(bytes).toStrictEqual(before);
  });

  it('fails loudly on a UTF-16 file with an odd number of bytes', () => {
    const bytes = encodeFileText(STRINGS_BODY, 'utf16le');
    expect(() => decodeFileText(bytes.subarray(0, bytes.length - 1))).toThrow(
      /odd number of bytes/
    );
  });

  it('fails loudly on a UTF-32 file whose length is not a multiple of four', () => {
    const bytes = encodeFileText(STRINGS_BODY, 'utf32le');
    expect(() => decodeFileText(bytes.subarray(0, bytes.length - 1))).toThrow(
      /multiple of four/
    );
  });

  it('fails loudly on a UTF-32 value that is not a code point', () => {
    const bytes = Buffer.concat([
      Buffer.from([0xff, 0xfe, 0x00, 0x00]),
      Buffer.from([0x00, 0x00, 0x11, 0x00]),
    ]);
    expect(() => decodeFileText(bytes)).toThrow(/not a Unicode code point/);
  });

  it('decodes bodies longer than one String.fromCodePoint call', () => {
    const body = '"k" = "é";\n'.repeat(2000);
    expect(decodeFileText(encodeFileText(body, 'utf32be')).text).toBe(body);
  });
});

// The two boundary functions are where a format decides whether an encoding is
// even in play, so they are exercised against real files on disk.
describe('readFileContent / encodeFileContent', () => {
  let dir: string;

  beforeAll(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gt-file-content-'));
  });

  afterAll(() => {
    fs.rmSync(dir, { recursive: true, force: true });
  });

  function write(name: string, bytes: Buffer): string {
    const filePath = path.join(dir, name);
    fs.writeFileSync(filePath, bytes);
    return filePath;
  }

  it.each(['DOT_STRINGS', 'DOT_STRINGSDICT'] as const)(
    'decodes a %s file by its byte order mark',
    (fileFormat) => {
      const filePath = write(
        `source-${fileFormat}.txt`,
        encodeFileText(STRINGS_BODY, 'utf16be')
      );
      expect(readFileContent(filePath, fileFormat)).toBe(STRINGS_BODY);
    }
  );

  it('reads other text formats as UTF-8 without touching them', () => {
    // The bytes are UTF-16, but JSON has no byte-order-mark convention, so the
    // reader must not start guessing on its behalf.
    const filePath = write('a.json', encodeFileText('{"a":"b"}', 'utf16le'));
    expect(readFileContent(filePath, 'JSON')).toBe(
      fs.readFileSync(filePath, 'utf8')
    );
  });

  it('reads binary formats as base64', () => {
    const bytes = Buffer.from([0x50, 0x4b, 0x03, 0x04, 0xff, 0x00]);
    const filePath = write('a.lottie', bytes);
    expect(readFileContent(filePath, 'LOTTIE')).toBe(bytes.toString('base64'));
  });

  it('returns empty content for a file that is not there', () => {
    expect(
      readFileContent(path.join(dir, 'missing.strings'), 'DOT_STRINGS')
    ).toBe('');
  });

  it.each([
    'utf8',
    'utf8-bom',
    'utf16le',
    'utf16be',
    'utf32le',
    'utf32be',
  ] as const)(
    'writes a translation back in the source encoding %s',
    (encoding) => {
      const source = write(
        `round-${encoding}.strings`,
        encodeFileText(STRINGS_BODY, encoding)
      );
      const written = encodeFileContent(STRINGS_BODY, 'DOT_STRINGS', source);
      const bytes = Buffer.isBuffer(written)
        ? written
        : Buffer.from(written, 'utf8');
      expect(bytes.equals(encodeFileText(STRINGS_BODY, encoding))).toBe(true);
    }
  );

  it('leaves formats with no encoding convention as the string it was given', () => {
    const source = write('b.json', encodeFileText('{"a":"b"}', 'utf16le'));
    expect(encodeFileContent('{"a":"c"}', 'JSON', source)).toBe('{"a":"c"}');
  });

  it('writes UTF-8 when the source file is gone', () => {
    expect(
      encodeFileContent(
        STRINGS_BODY,
        'DOT_STRINGS',
        path.join(dir, 'nope.strings')
      )
    ).toBe(STRINGS_BODY);
  });
});
