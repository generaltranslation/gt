import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { isBinaryFileFormat } from 'generaltranslation/types';
import { aggregateFiles } from '../aggregateFiles.js';
import { encodeFileContent } from '../../../fs/fileContent.js';
import type { Settings } from '../../../types/index.js';

// Exercises the real filesystem helpers rather than mocks: the bug this covers
// was in how the bytes were read, so a mocked read cannot see it.
//
// The contract is that the API only ever receives UTF-8 text, and that writing
// a translation back reproduces the source file's own encoding. Encoding never
// leaves the client.

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

    function pathFor(name: string): string {
      return path.join(dir, `${name}.${extension}`);
    }

    /** The bytes the SDK puts on the wire for a single aggregated source file. */
    async function wireBytesFor(name: string): Promise<Buffer> {
      const { files } = await aggregateFiles({
        files: {
          resolvedPaths: { [settingsKey]: [pathFor(name)] },
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
      'delivers %s to the API as UTF-8 text',
      async (name) => {
        const bytes = await wireBytesFor(name);
        expect(bytes.equals(Buffer.from(body, 'utf8'))).toBe(true);
        expect(bytes.toString('utf8')).toBe(body);
        expect(bytes.toString('utf8')).not.toContain('�');
      }
    );

    it('sends no byte order mark, whatever the source carried', async () => {
      for (const name of Object.keys(FIXTURES)) {
        const bytes = await wireBytesFor(name);
        expect(bytes.subarray(0, 3)).not.toStrictEqual(
          Buffer.from([0xef, 0xbb, 0xbf])
        );
        expect(bytes.subarray(0, 2)).not.toStrictEqual(
          Buffer.from([0xff, 0xfe])
        );
        expect(bytes.subarray(0, 2)).not.toStrictEqual(
          Buffer.from([0xfe, 0xff])
        );
      }
    });

    // Reading raw UTF-8 is what the CLI used to do for `.stringsdict`. If these
    // still decoded cleanly, the byte-order-mark handling would not be
    // load-bearing.
    it.each(['utf16le', 'utf16be'])(
      'is load bearing: reading %s as UTF-8 corrupts it',
      (name) => {
        const raw = fs.readFileSync(pathFor(name), 'utf8');
        expect(raw).not.toBe(body);
        expect(raw).toContain('�');
      }
    );

    // The write path re-encodes to the source file's layout. Together with the
    // read above this is the full round trip: bytes in, UTF-8 over the wire,
    // identical bytes back out.
    it.each(Object.keys(FIXTURES))(
      'writes a translation of %s back in the source encoding',
      async (name) => {
        const wire = await wireBytesFor(name);
        // The same call downloadFileBatch makes before writing to disk.
        const written = encodeFileContent(
          wire.toString('utf8'),
          fileFormat,
          pathFor(name)
        );
        const bytes = Buffer.isBuffer(written)
          ? written
          : Buffer.from(written, 'utf8');
        expect(bytes.equals(FIXTURES[name])).toBe(true);
      }
    );
  }
);
