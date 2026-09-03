import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import os from 'node:os';
import { collectAndSendUserEditDiffs } from '../collectUserEditDiffs.js';
import { createMockSettings } from '../__mocks__/settings.js';
import { gt } from '../../utils/gt.js';
import { logger } from '../../console/logger.js';
import { clearWarnings, getWarnings } from '../../state/translateWarnings.js';
import type { FileReference } from 'generaltranslation/types';
import type { DownloadedVersionsV1 } from '../../fs/config/downloadedVersions.js';

// Runs the real `git diff --no-index` rather than mocking it: the defect here is
// what gets written to the comparison file, which a mocked differ cannot see.
vi.mock('../../utils/gt.js', () => ({
  gt: {
    queryFileData: vi.fn(),
    downloadFileBatch: vi.fn(),
    submitUserEditDiffs: vi.fn(),
  },
}));

const SOURCE = 'Guardian/en.lproj/Localizable.strings';

const TRANSLATION =
  '/* Localizable.strings */\n' +
  '"app.title" = "Pocket Café";\n' +
  '"welcome" = "¡Bienvenido!";\n';

const utf16leWithBom = (text: string) =>
  Buffer.concat([Buffer.from([0xff, 0xfe]), Buffer.from(text, 'utf16le')]);

describe('collectAndSendUserEditDiffs - base64-carried formats', () => {
  const originalCwd = process.cwd();
  let tempDir: string;
  let warn: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    tempDir = fs.realpathSync(
      fs.mkdtempSync(path.join(os.tmpdir(), 'gt-user-edit-'))
    );
    process.chdir(tempDir);
    vi.clearAllMocks();
    clearWarnings();
    warn = vi.spyOn(logger, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    process.chdir(originalCwd);
    fs.rmSync(tempDir, { recursive: true, force: true });
    clearWarnings();
    vi.resetAllMocks();
  });

  const buildSettings = () =>
    createMockSettings({
      configDirectory: tempDir,
      config: path.join(tempDir, 'gt.config.json'),
      defaultLocale: 'en',
      locales: ['es'],
      _branchId: 'branch1',
      files: {
        resolvedPaths: {
          dotStrings: [path.join(tempDir, SOURCE)],
        },
        placeholderPaths: {
          dotStrings: [
            path.join(
              tempDir,
              'Guardian',
              '[locale].lproj',
              'Localizable.strings'
            ),
          ],
        },
        transformPaths: {},
      },
    });

  const writeLockFile = (content: DownloadedVersionsV1) => {
    fs.writeFileSync(
      path.join(tempDir, 'gt-lock.json'),
      JSON.stringify(content, null, 2)
    );
  };

  const seedLockFile = () =>
    writeLockFile({
      version: 1,
      entries: {
        branch1: {
          file1: {
            version1: {
              es: { updatedAt: new Date().toISOString() },
            },
          },
        },
      },
    });

  /** Writes the translated output the user would have downloaded and edited. */
  const writeTranslation = (bytes: Buffer) => {
    const outputPath = path.join(
      tempDir,
      'Guardian',
      'es.lproj',
      'Localizable.strings'
    );
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.writeFileSync(outputPath, bytes);
    return outputPath;
  };

  /** Mirrors core's downloadFileBatch, which leaves base64 formats encoded. */
  const mockServerDownload = (base64Data: string, fileFormat: string) => {
    vi.mocked(gt.queryFileData).mockResolvedValue({
      translatedFiles: [
        {
          branchId: 'branch1',
          fileId: 'file1',
          versionId: 'version1',
          locale: 'es',
          completedAt: new Date().toISOString(),
        },
      ],
    });
    vi.mocked(gt.downloadFileBatch).mockResolvedValue({
      files: [
        {
          branchId: 'branch1',
          fileId: 'file1',
          versionId: 'version1',
          locale: 'es',
          fileFormat,
          data: base64Data,
        },
      ],
    } as unknown as Awaited<ReturnType<typeof gt.downloadFileBatch>>);
  };

  const filesUnderTest = (fileFormat: string): FileReference[] => [
    {
      fileName: SOURCE,
      fileFormat,
      branchId: 'branch1',
      fileId: 'file1',
      versionId: 'version1',
    } as FileReference,
  ];

  it('reports no edit when an untouched .strings translation matches the server', async () => {
    const settings = buildSettings();
    seedLockFile();
    writeTranslation(Buffer.from(TRANSLATION, 'utf8'));
    mockServerDownload(
      Buffer.from(TRANSLATION, 'utf8').toString('base64'),
      'DOT_STRINGS'
    );

    const hadDiffs = await collectAndSendUserEditDiffs(
      filesUnderTest('DOT_STRINGS'),
      settings
    );

    expect(gt.downloadFileBatch).toHaveBeenCalledTimes(1);
    expect(gt.submitUserEditDiffs).not.toHaveBeenCalled();
    expect(hadDiffs).toBe(false);
  });

  it('diffs an edited .strings translation against the decoded server text', async () => {
    const settings = buildSettings();
    seedLockFile();
    writeTranslation(
      Buffer.from(TRANSLATION.replace('¡Bienvenido!', '¡Hola!'), 'utf8')
    );
    mockServerDownload(
      Buffer.from(TRANSLATION, 'utf8').toString('base64'),
      'DOT_STRINGS'
    );

    await collectAndSendUserEditDiffs(filesUnderTest('DOT_STRINGS'), settings);

    expect(gt.submitUserEditDiffs).toHaveBeenCalledTimes(1);
    const [{ diffs }] = vi.mocked(gt.submitUserEditDiffs).mock.calls[0];
    expect(diffs).toHaveLength(1);
    expect(diffs[0].diff).toContain('-"welcome" = "¡Bienvenido!";');
    expect(diffs[0].diff).toContain('+"welcome" = "¡Hola!";');
    expect(diffs[0].localContent).toContain('"welcome" = "¡Hola!";');
  });

  it('submits the edit when the recorded server baseline is empty', async () => {
    const settings = buildSettings();
    seedLockFile();
    writeTranslation(Buffer.from(TRANSLATION, 'utf8'));
    // An empty payload is a baseline of "nothing", not a missing download.
    // Treating the two alike drops everything the user wrote against it.
    mockServerDownload('', 'DOT_STRINGS');

    await collectAndSendUserEditDiffs(filesUnderTest('DOT_STRINGS'), settings);

    expect(gt.submitUserEditDiffs).toHaveBeenCalledTimes(1);
    const [{ diffs }] = vi.mocked(gt.submitUserEditDiffs).mock.calls[0];
    expect(diffs[0].diff).toContain('+"welcome" = "¡Bienvenido!";');
    expect(diffs[0].localContent).toBe(TRANSLATION);
  });

  it('skips silently when the batch download returned no copy of the file', async () => {
    const settings = buildSettings();
    seedLockFile();
    writeTranslation(Buffer.from(TRANSLATION, 'utf8'));
    vi.mocked(gt.queryFileData).mockResolvedValue({
      translatedFiles: [
        {
          branchId: 'branch1',
          fileId: 'file1',
          versionId: 'version1',
          locale: 'es',
          completedAt: new Date().toISOString(),
        },
      ],
    });
    vi.mocked(gt.downloadFileBatch).mockResolvedValue({
      files: [],
    } as unknown as Awaited<ReturnType<typeof gt.downloadFileBatch>>);

    await collectAndSendUserEditDiffs(filesUnderTest('DOT_STRINGS'), settings);

    // No baseline at all, so there is nothing to diff and nothing to report.
    expect(gt.submitUserEditDiffs).not.toHaveBeenCalled();
    expect(warn).not.toHaveBeenCalled();
  });

  it('warns instead of submitting a UTF-16 .strings edit it cannot represent as text', async () => {
    const settings = buildSettings();
    seedLockFile();
    writeTranslation(
      utf16leWithBom(TRANSLATION.replace('¡Bienvenido!', '¡Hola!'))
    );
    mockServerDownload(
      utf16leWithBom(TRANSLATION).toString('base64'),
      'DOT_STRINGS'
    );

    await collectAndSendUserEditDiffs(filesUnderTest('DOT_STRINGS'), settings);

    // Reading UTF-16 bytes as UTF-8 yields U+FFFD, so there is no faithful
    // diff or localContent to send. Sending nothing beats sending mojibake,
    // but dropping the edit without saying so is its own failure.
    expect(gt.submitUserEditDiffs).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining('Guardian/es.lproj/Localizable.strings')
    );
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('UTF-8'));
    expect(getWarnings()).toContainEqual({
      category: 'skipped_file',
      fileName: 'Guardian/es.lproj/Localizable.strings',
      reason: expect.stringContaining('UTF-8'),
    });
  });

  it('stays quiet when a translation is byte-identical to the server copy', async () => {
    const settings = buildSettings();
    seedLockFile();
    const unchanged = utf16leWithBom(TRANSLATION);
    writeTranslation(unchanged);
    mockServerDownload(unchanged.toString('base64'), 'DOT_STRINGS');

    await collectAndSendUserEditDiffs(filesUnderTest('DOT_STRINGS'), settings);

    // Nothing was edited, so there is nothing to warn about.
    expect(gt.submitUserEditDiffs).not.toHaveBeenCalled();
    expect(warn).not.toHaveBeenCalled();
    expect(getWarnings()).toHaveLength(0);
  });

  it('warns instead of submitting a changed Lottie bundle, whose bytes have no text form', async () => {
    const settings = createMockSettings({
      configDirectory: tempDir,
      config: path.join(tempDir, 'gt.config.json'),
      defaultLocale: 'en',
      locales: ['es'],
      _branchId: 'branch1',
      files: {
        resolvedPaths: {
          lottie: [path.join(tempDir, 'anim', 'en', 'spinner.lottie')],
        },
        placeholderPaths: {
          lottie: [path.join(tempDir, 'anim', '[locale]', 'spinner.lottie')],
        },
        transformPaths: {},
      },
    });
    seedLockFile();

    // A zip local header: 0x50 0x4b 0x03 0x04 followed by non-UTF-8 bytes.
    const serverZip = Buffer.from([0x50, 0x4b, 0x03, 0x04, 0xff, 0xfe, 0x00]);
    const localZip = Buffer.from([0x50, 0x4b, 0x03, 0x04, 0xff, 0xfe, 0x01]);
    const outputPath = path.join(tempDir, 'anim', 'es', 'spinner.lottie');
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.writeFileSync(outputPath, localZip);
    mockServerDownload(serverZip.toString('base64'), 'LOTTIE');

    await collectAndSendUserEditDiffs(
      [
        {
          fileName: 'anim/en/spinner.lottie',
          fileFormat: 'LOTTIE',
          branchId: 'branch1',
          fileId: 'file1',
          versionId: 'version1',
        } as FileReference,
      ],
      settings
    );

    expect(gt.submitUserEditDiffs).not.toHaveBeenCalled();
    expect(getWarnings()).toContainEqual({
      category: 'skipped_file',
      fileName: 'anim/es/spinner.lottie',
      reason: expect.stringContaining('UTF-8'),
    });
  });
});
