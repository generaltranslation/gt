import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import os from 'node:os';
import { collectAndSendUserEditDiffs } from '../collectUserEditDiffs.js';
import { createMockSettings } from '../__mocks__/settings.js';
import { api } from '../../utils/api.js';
import { logger } from '../../console/logger.js';
import { clearWarnings, getWarnings } from '../../state/translateWarnings.js';
import { hashStringSync } from '../../utils/hash.js';
import type { FileReference } from 'generaltranslation/types';
import type { DownloadedVersionsV1 } from '../../fs/config/downloadedVersions.js';

vi.mock('../../utils/api.js', () => ({
  api: {
    queryFileData: vi.fn(),
    downloadFileBatch: vi.fn(),
    submitUserEditDiffs: vi.fn(),
  },
}));

const FILE_NAME = 'docs/doc.md';
const SERVER_CONTENT = '# title\n\nbody\n';
const EDITED_CONTENT = '# title\n\nbody edited\n';

describe('collectAndSendUserEditDiffs - lockfile branch selection', () => {
  const originalCwd = process.cwd();
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.realpathSync(
      fs.mkdtempSync(path.join(os.tmpdir(), 'gt-edit-branch-'))
    );
    process.chdir(tempDir);
    vi.clearAllMocks();
    clearWarnings();
  });

  afterEach(() => {
    process.chdir(originalCwd);
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  const buildSettings = () =>
    createMockSettings({
      configDirectory: tempDir,
      config: path.join(tempDir, 'gt.config.json'),
      defaultLocale: 'en',
      locales: ['ja'],
      files: {
        resolvedPaths: { md: [path.join(tempDir, FILE_NAME)] },
        placeholderPaths: {
          md: [path.join(tempDir, 'docs', '[locale]', 'doc.md')],
        },
        transformPaths: {},
      },
    });

  const writeLocal = () => {
    writeFile(EDITED_CONTENT);
  };

  const writeFile = (content: string) => {
    const outputPath = path.join(tempDir, 'docs', 'ja', 'doc.md');
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.writeFileSync(outputPath, content);
  };

  /**
   * A v1 lockfile keeps every branch it has ever seen. The stale branch is
   * listed first, as it is in the report that motivated this test.
   */
  const writeLockFile = () => {
    writeLockFileWithHash();
  };

  /** The current branch records a hash the edited file no longer matches. */
  const writeLockFileWithHash = (postProcessHash?: string) => {
    const lockfile: DownloadedVersionsV1 = {
      version: 1,
      entries: {
        'stale-branch': {
          file1: {
            'version-stale': {
              ja: { updatedAt: '2026-01-01T00:00:00.000Z' },
            },
          },
        },
        'branch-1': {
          file1: {
            'version-current': {
              ja: {
                updatedAt: '2026-11-01T00:00:00.000Z',
                ...(postProcessHash ? { postProcessHash } : {}),
              },
            },
          },
        },
      },
    };
    fs.writeFileSync(
      path.join(tempDir, 'gt-lock.json'),
      JSON.stringify(lockfile, null, 2)
    );
  };

  const filesUnderTest = (): FileReference[] =>
    [
      {
        fileName: FILE_NAME,
        fileFormat: 'MD',
        branchId: 'branch-1',
        fileId: 'file1',
        versionId: 'version-current',
      },
    ] as FileReference[];

  const mockServerForCurrentVersion = () => {
    // Answers only for the version the current branch actually downloaded.
    vi.mocked(api.queryFileData).mockImplementation(async (query) => {
      const requested =
        (query as { translatedFiles?: { versionId: string }[] })
          .translatedFiles ?? [];
      const matches = requested.filter(
        (file) => file.versionId === 'version-current'
      );
      return {
        translatedFiles: matches.map((file) => ({
          branchId: 'branch-1',
          fileId: 'file1',
          versionId: file.versionId,
          locale: 'ja',
          completedAt: '2026-11-01T00:00:00.000Z',
        })),
      } as unknown as Awaited<ReturnType<typeof api.queryFileData>>;
    });
    vi.mocked(api.downloadFileBatch).mockResolvedValue({
      files: [
        {
          branchId: 'branch-1',
          fileId: 'file1',
          versionId: 'version-current',
          locale: 'ja',
          fileFormat: 'MD',
          data: SERVER_CONTENT,
        },
      ],
    } as unknown as Awaited<ReturnType<typeof api.downloadFileBatch>>);
  };

  it('diffs against the branch its files belong to, not the first branch in the lockfile', async () => {
    const settings = buildSettings();
    writeLockFile();
    writeLocal();
    mockServerForCurrentVersion();

    const hadDiffs = await collectAndSendUserEditDiffs(
      filesUnderTest(),
      settings
    );

    expect(api.queryFileData).toHaveBeenCalledTimes(1);
    const [{ translatedFiles }] = [
      vi.mocked(api.queryFileData).mock.calls[0][0] as {
        translatedFiles: { versionId: string }[];
      },
    ];
    expect(translatedFiles.map((file) => file.versionId)).toEqual([
      'version-current',
    ]);
    expect(api.submitUserEditDiffs).toHaveBeenCalledTimes(1);
    const [{ diffs }] = vi.mocked(api.submitUserEditDiffs).mock.calls[0];
    expect(diffs).toHaveLength(1);
    expect(diffs[0].versionId).toBe('version-current');
    expect(diffs[0].diff).toContain('-body');
    expect(diffs[0].diff).toContain('+body edited');
    expect(hadDiffs).toBe(true);
  });

  it('uses the branch resolved for this run, not one persisted by an earlier run', async () => {
    // `_branchId` is persisted into the config by an earlier translation, so it
    // can name a different branch than the one resolved for this invocation.
    const settings = {
      ...buildSettings(),
      _branchId: 'stale-branch',
    };
    writeLockFile();
    writeLocal();
    mockServerForCurrentVersion();

    const hadDiffs = await collectAndSendUserEditDiffs(
      filesUnderTest(),
      settings
    );

    const [{ translatedFiles }] = [
      vi.mocked(api.queryFileData).mock.calls[0][0] as {
        translatedFiles: { versionId: string }[];
      },
    ];
    expect(translatedFiles.map((file) => file.versionId)).toEqual([
      'version-current',
    ]);
    expect(api.submitUserEditDiffs).toHaveBeenCalledTimes(1);
    expect(hadDiffs).toBe(true);
    expect(settings._branchId).toBe('stale-branch');
  });

  it('warns when a known local edit has no server version to compare against', async () => {
    const warn = vi.spyOn(logger, 'warn').mockImplementation(() => {});
    const settings = buildSettings();
    // A recorded hash the edited file no longer matches makes the edit known.
    writeLockFileWithHash(hashStringSync(SERVER_CONTENT));
    writeLocal();
    vi.mocked(api.queryFileData).mockReset();
    vi.mocked(api.downloadFileBatch).mockReset();
    // The server holds no copy of the version the lockfile records.
    vi.mocked(api.queryFileData).mockResolvedValue({
      translatedFiles: [],
    } as unknown as Awaited<ReturnType<typeof api.queryFileData>>);

    await collectAndSendUserEditDiffs(filesUnderTest(), settings);

    expect(api.submitUserEditDiffs).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalledTimes(1);
    const [message] = warn.mock.calls[0];
    expect(String(message)).toContain('ja');
    expect(String(message)).toContain('could not be compared');
    expect(getWarnings()).toContainEqual(
      expect.objectContaining({ category: 'skipped_file' })
    );
    warn.mockRestore();
  });

  it('stays quiet when the local file matches the recorded hash', async () => {
    const warn = vi.spyOn(logger, 'warn').mockImplementation(() => {});
    const settings = buildSettings();
    writeFile(SERVER_CONTENT);
    writeLockFileWithHash(hashStringSync(SERVER_CONTENT));

    await collectAndSendUserEditDiffs(filesUnderTest(), settings);

    expect(api.queryFileData).not.toHaveBeenCalled();
    expect(api.submitUserEditDiffs).not.toHaveBeenCalled();
    expect(warn).not.toHaveBeenCalled();
    warn.mockRestore();
  });
});
