import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import os from 'node:os';
import { collectAndSendUserEditDiffs } from '../collectUserEditDiffs.js';
import { createMockSettings } from '../__mocks__/settings.js';
import { api } from '../../utils/api.js';
import { clearWarnings } from '../../state/translateWarnings.js';
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
    const outputPath = path.join(tempDir, 'docs', 'ja', 'doc.md');
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.writeFileSync(outputPath, EDITED_CONTENT);
  };

  /**
   * A v1 lockfile keeps every branch it has ever seen. The stale branch is
   * listed first, as it is in the report that motivated this test.
   */
  const writeLockFile = () => {
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
              ja: { updatedAt: '2026-11-01T00:00:00.000Z' },
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

  it('keeps the caller-supplied branch when settings already carries one', async () => {
    const settings = {
      ...buildSettings(),
      _branchId: 'stale-branch',
    };
    writeLockFile();
    writeLocal();
    mockServerForCurrentVersion();

    // An explicit branch on the settings is authoritative: it reads the stale
    // branch's entry, which has no server version to diff against.
    await collectAndSendUserEditDiffs(filesUnderTest(), settings);

    const [{ translatedFiles }] = [
      vi.mocked(api.queryFileData).mock.calls[0][0] as {
        translatedFiles: { versionId: string }[];
      },
    ];
    expect(translatedFiles.map((file) => file.versionId)).toEqual([
      'version-stale',
    ]);
    expect(api.submitUserEditDiffs).not.toHaveBeenCalled();
  });
});
