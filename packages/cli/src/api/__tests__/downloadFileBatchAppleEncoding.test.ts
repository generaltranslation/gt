import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import os from 'node:os';
import { downloadFileBatch } from '../downloadFileBatch.js';
import { createMockSettings } from '../__mocks__/settings.js';
import { gt } from '../../utils/gt.js';
import type { FileStatusTracker } from '../../workflows/steps/PollJobsStep.js';

// Writes to a real temporary directory rather than a mocked `fs`: the point of
// this path is the bytes that land on disk, which a mocked writer cannot show.
vi.mock('../../utils/gt.js', () => ({
  gt: {
    downloadFileBatch: vi.fn(),
    resolveAliasLocale: vi.fn((locale: string) => locale),
    resolveCanonicalLocale: vi.fn((locale: string) => locale),
  },
}));

vi.mock('../../console/logger.js', () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
}));

const SOURCE_BODY =
  '/* Localizable.strings */\n' +
  '"app.title" = "Pocket Café";\n' +
  '"welcome" = "¡Bienvenido!";\n';

const TRANSLATED_BODY =
  '/* Localizable.strings */\n' +
  '"app.title" = "Poche Café";\n' +
  '"welcome" = "Bienvenue !";\n';

const STRINGSDICT_TRANSLATED =
  '<?xml version="1.0" encoding="UTF-8"?>\n' +
  '<plist version="1.0">\n' +
  '<dict>\n' +
  '\t<key>note.count</key>\n' +
  '\t<string>%lld notes</string>\n' +
  '</dict>\n' +
  '</plist>\n';

/** Byte layouts a source file may already be in, byte order marks included. */
const ENCODERS: Record<string, (text: string) => Buffer> = {
  utf8: (text) => Buffer.from(text, 'utf8'),
  'utf8-bom': (text) =>
    Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), Buffer.from(text, 'utf8')]),
  utf16le: (text) =>
    Buffer.concat([Buffer.from([0xff, 0xfe]), Buffer.from(text, 'utf16le')]),
  utf16be: (text) =>
    Buffer.concat([
      Buffer.from([0xfe, 0xff]),
      Buffer.from(text, 'utf16le').swap16(),
    ]),
};

describe('downloadFileBatch - Apple file encodings', () => {
  const originalCwd = process.cwd();
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.realpathSync(
      fs.mkdtempSync(path.join(os.tmpdir(), 'gt-download-encoding-'))
    );
    process.chdir(tempDir);
    vi.clearAllMocks();
  });

  afterEach(() => {
    process.chdir(originalCwd);
    fs.rmSync(tempDir, { recursive: true, force: true });
    vi.resetAllMocks();
  });

  /**
   * Runs one download whose source file is already in `encoding`, and returns
   * the bytes written for the translation.
   */
  async function downloadOne({
    encoding,
    sourceBody,
    translatedBody,
    fileFormat,
    extension,
  }: {
    encoding: keyof typeof ENCODERS;
    sourceBody: string;
    translatedBody: string;
    fileFormat: string;
    extension: string;
  }): Promise<Buffer> {
    const inputPath = path.join(tempDir, `en.lproj/Localizable.${extension}`);
    const outputPath = path.join(tempDir, `fr.lproj/Localizable.${extension}`);
    fs.mkdirSync(path.dirname(inputPath), { recursive: true });
    fs.writeFileSync(inputPath, ENCODERS[encoding](sourceBody));

    const key = 'branch1:file1:version1:fr';
    const fileTracker = {
      completed: new Map([
        [
          key,
          {
            fileId: 'file1',
            versionId: 'version1',
            locale: 'fr',
            branchId: 'branch1',
            fileName: inputPath,
          },
        ],
      ]),
      inProgress: new Map(),
      failed: new Map(),
      skipped: new Map(),
    } as unknown as FileStatusTracker;

    // Text formats arrive already decoded to a UTF-8 string from core.
    vi.mocked(gt.downloadFileBatch).mockResolvedValue({
      files: [
        {
          branchId: 'branch1',
          fileId: 'file1',
          versionId: 'version1',
          locale: 'fr',
          fileFormat,
          data: translatedBody,
        },
      ],
    } as unknown as Awaited<ReturnType<typeof gt.downloadFileBatch>>);

    const result = await downloadFileBatch(
      fileTracker,
      [
        {
          branchId: 'branch1',
          fileId: 'file1',
          versionId: 'version1',
          locale: 'fr',
          outputPath,
          inputPath,
        },
      ],
      createMockSettings({
        configDirectory: tempDir,
        config: path.join(tempDir, 'gt.config.json'),
        defaultLocale: 'en',
        locales: ['fr'],
      })
    );

    expect(result.successful).toHaveLength(1);
    return fs.readFileSync(outputPath);
  }

  it.each(Object.keys(ENCODERS))(
    'writes a translated .strings file in the source encoding %s',
    async (encoding) => {
      const written = await downloadOne({
        encoding: encoding as keyof typeof ENCODERS,
        sourceBody: SOURCE_BODY,
        translatedBody: TRANSLATED_BODY,
        fileFormat: 'DOT_STRINGS',
        extension: 'strings',
      });

      expect(written.equals(ENCODERS[encoding](TRANSLATED_BODY))).toBe(true);
    }
  );

  it.each(Object.keys(ENCODERS))(
    'writes a translated .stringsdict file in the source encoding %s',
    async (encoding) => {
      const written = await downloadOne({
        encoding: encoding as keyof typeof ENCODERS,
        sourceBody: STRINGSDICT_TRANSLATED,
        translatedBody: STRINGSDICT_TRANSLATED,
        fileFormat: 'DOT_STRINGSDICT',
        extension: 'stringsdict',
      });

      expect(written.equals(ENCODERS[encoding](STRINGSDICT_TRANSLATED))).toBe(
        true
      );
    }
  );

  it('leaves a byte-order-mark-less UTF-8 source byte-order-mark-less', async () => {
    const written = await downloadOne({
      encoding: 'utf8',
      sourceBody: SOURCE_BODY,
      translatedBody: TRANSLATED_BODY,
      fileFormat: 'DOT_STRINGS',
      extension: 'strings',
    });

    // Encoding is per file. A UTF-8 repository must see no new bytes at all.
    expect(written.subarray(0, 3)).not.toStrictEqual(
      Buffer.from([0xef, 0xbb, 0xbf])
    );
    expect(written.toString('utf8')).toBe(TRANSLATED_BODY);
  });

  it('does not re-encode formats that are not Apple localization files', async () => {
    const written = await downloadOne({
      encoding: 'utf16le',
      sourceBody: '{"a":"b"}\n',
      translatedBody: '{"a":"c"}\n',
      fileFormat: 'JSON',
      extension: 'json',
    });

    // The source happens to be UTF-16, but JSON has no such convention, so the
    // output stays UTF-8 whatever the source looked like.
    expect(written.subarray(0, 2)).not.toStrictEqual(Buffer.from([0xff, 0xfe]));
    expect(JSON.parse(written.toString('utf8'))).toEqual({ a: 'c' });
  });
});
