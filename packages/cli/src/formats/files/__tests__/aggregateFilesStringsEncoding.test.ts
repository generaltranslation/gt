import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { isBinaryFileFormat } from 'generaltranslation/types';
import { aggregateFiles } from '../aggregateFiles.js';
import type { Settings } from '../../../types/index.js';

// Exercises the real filesystem helpers rather than mocks: the bug this covers
// was in how the bytes were read, so a mocked read cannot see it.

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

const utf16le = (text: string) => Buffer.from(text, 'utf16le');

/** Byte layouts Xcode has shipped over the years, byte order marks included. */
function encodings(body: string): Record<string, Buffer> {
  return {
    utf16le: Buffer.concat([Buffer.from([0xff, 0xfe]), utf16le(body)]),
    utf16be: Buffer.concat([Buffer.from([0xfe, 0xff]), utf16le(body).swap16()]),
    utf8: Buffer.from(body, 'utf8'),
    'utf8-bom': Buffer.concat([
      Buffer.from([0xef, 0xbb, 0xbf]),
      Buffer.from(body, 'utf8'),
    ]),
  };
}

/** Mirrors the API's byte-order-mark-directed decode. */
function decodeByBom(bytes: Buffer): string {
  if (bytes[0] === 0xff && bytes[1] === 0xfe) {
    return bytes.subarray(2).toString('utf16le');
  }
  if (bytes[0] === 0xfe && bytes[1] === 0xff) {
    return Buffer.from(bytes.subarray(2)).swap16().toString('utf16le');
  }
  if (bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) {
    return bytes.subarray(3).toString('utf8');
  }
  return bytes.toString('utf8');
}

const CASES = [
  {
    label: '.strings',
    settingsKey: 'dotStrings',
    fileFormat: 'DOT_STRINGS',
    extension: 'strings',
    body: STRINGS_BODY,
  },
  {
    label: '.stringsdict',
    settingsKey: 'dotStringsdict',
    fileFormat: 'DOT_STRINGSDICT',
    extension: 'stringsdict',
    body: STRINGSDICT_BODY,
  },
] as const;

describe.each(CASES)(
  'aggregateFiles - $label encodings',
  ({ settingsKey, fileFormat, extension, body }) => {
    const FIXTURES = encodings(body);
    let dir: string;

    beforeAll(() => {
      dir = fs.mkdtempSync(path.join(os.tmpdir(), `gt-${extension}-`));
      for (const [name, bytes] of Object.entries(FIXTURES)) {
        fs.writeFileSync(path.join(dir, `${name}.${extension}`), bytes);
      }
    });

    afterAll(() => {
      fs.rmSync(dir, { recursive: true, force: true });
    });

    /** The base64 the SDK puts on the wire for a single aggregated source file. */
    async function wireBytesFor(name: string): Promise<Buffer> {
      const { files } = await aggregateFiles({
        files: {
          resolvedPaths: {
            [settingsKey]: [path.join(dir, `${name}.${extension}`)],
          },
          placeholderPaths: {},
        },
        options: {},
        defaultLocale: 'en',
      } as unknown as Settings);

      expect(files).toHaveLength(1);
      expect(files[0].fileFormat).toBe(fileFormat);

      // Same branch _uploadSourceFiles takes when building the request body.
      const wire = isBinaryFileFormat(files[0].fileFormat)
        ? files[0].content
        : Buffer.from(files[0].content, 'utf8').toString('base64');
      return Buffer.from(wire, 'base64');
    }

    it.each(Object.keys(FIXTURES))(
      'delivers %s to the API byte for byte',
      async (name) => {
        const bytes = await wireBytesFor(name);
        expect(bytes.equals(FIXTURES[name])).toBe(true);
        expect(decodeByBom(bytes)).toBe(body);
        expect(decodeByBom(bytes)).not.toContain('�');
      }
    );

    it('keeps the byte order mark the API decodes by', async () => {
      expect((await wireBytesFor('utf16le')).subarray(0, 2)).toStrictEqual(
        Buffer.from([0xff, 0xfe])
      );
      expect((await wireBytesFor('utf16be')).subarray(0, 2)).toStrictEqual(
        Buffer.from([0xfe, 0xff])
      );
      expect((await wireBytesFor('utf8-bom')).subarray(0, 3)).toStrictEqual(
        Buffer.from([0xef, 0xbb, 0xbf])
      );
    });
  }
);
