import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  UploadTranslationsStep,
  partitionTranslationsByLockfile,
} from '../UploadTranslationsStep.js';
import { logger } from '../../../console/logger.js';
import {
  readLockfile,
  writeLockfile,
  buildEntryMap,
  type DownloadedVersionEntry,
} from '../../../fs/config/downloadedVersions.js';
import { hashStringSync } from '../../../utils/hash.js';
import type { GT } from 'generaltranslation';
import type { Settings } from '../../../types/index.js';
import type { FileToUpload } from 'generaltranslation/types';
import {
  clearWarnings,
  getWarnings,
} from '../../../state/translateWarnings.js';

const mockGt = {
  queryFiles: vi.fn(),
  uploadTranslations: vi.fn(),
};

// One result per translation, in request order
function uploadResults(
  results: Array<
    ReturnType<typeof confirmedUpload> & { status?: string; error?: string }
  >
) {
  const items = results.map((result) => ({
    status: 'succeeded',
    ...result,
  }));
  const failed = items.filter((r) => r.status === 'failed').length;
  return {
    summary: { total: items.length, succeeded: items.length - failed, failed },
    results: items,
  };
}

const mockSpinner = vi.hoisted(() => ({
  start: vi.fn(),
  stop: vi.fn(),
  message: vi.fn(),
}));

// Mock the logger
vi.mock('../../../console/logger.js', () => ({
  logger: {
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    createSpinner: () => mockSpinner,
  },
}));

// Mock only the lockfile I/O; keep the pure helpers (buildEntryMap,
// findOrCreateEntry) real
vi.mock('../../../fs/config/downloadedVersions.js', async (importOriginal) => {
  const actual =
    await importOriginal<
      typeof import('../../../fs/config/downloadedVersions.js')
    >();
  return {
    ...actual,
    readLockfile: vi.fn(),
    writeLockfile: vi.fn(),
  };
});

const mockSettings = {
  defaultLocale: 'en',
  modelProvider: undefined,
} as unknown as Settings;

function makeSource(fileId: string): FileToUpload {
  return {
    content: `source content ${fileId}`,
    fileName: `${fileId}.json`,
    fileFormat: 'JSON',
    locale: 'en',
    fileId,
    versionId: `version-${fileId}`,
  };
}

function makeTranslation(fileId: string, locale: string): FileToUpload {
  return {
    content: `translated content ${fileId} ${locale}`,
    fileName: `${locale}/${fileId}.json`,
    fileFormat: 'JSON',
    locale,
    fileId,
    versionId: `version-${fileId}`,
  };
}

function confirmedUpload(
  fileId: string,
  locale: string
): {
  branchId: string;
  fileId: string;
  versionId: string;
  fileName: string;
  fileFormat: 'JSON';
  locale: string;
} {
  return {
    branchId: 'branch-123',
    fileId,
    versionId: `version-${fileId}`,
    fileName: `${locale}/${fileId}.json`,
    fileFormat: 'JSON',
    locale,
  };
}

function mockLockfile(entries: DownloadedVersionEntry[]): void {
  vi.mocked(readLockfile).mockReturnValue({
    data: { version: 2, branchId: 'branch-123', entries },
    entryMap: buildEntryMap(entries),
    originalV1: null,
  });
}

describe('UploadTranslationsStep', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearWarnings();
    mockLockfile([]);
  });

  it('uploads every resolved translation file, including ones that already exist on the platform', async () => {
    const files = [
      {
        source: makeSource('file-1'),
        translations: [
          makeTranslation('file-1', 'es'),
          makeTranslation('file-1', 'fr'),
        ],
      },
    ];

    // Local files are the source of truth, so they are uploaded even when
    // the platform already has them (the endpoint is an upsert).
    mockGt.uploadTranslations.mockResolvedValue(
      uploadResults([
        confirmedUpload('file-1', 'es'),
        confirmedUpload('file-1', 'fr'),
      ])
    );

    const step = new UploadTranslationsStep(
      mockGt as unknown as GT,
      mockSettings
    );
    const result = await step.run({ files });

    // No existence check: everything local is sent
    expect(mockGt.queryFiles).not.toHaveBeenCalled();
    expect(mockGt.uploadTranslations).toHaveBeenCalledTimes(1);
    expect(mockGt.uploadTranslations).toHaveBeenCalledWith(files);
    expect(result).toEqual([
      confirmedUpload('file-1', 'es'),
      confirmedUpload('file-1', 'fr'),
    ]);
  });

  it('filters out files without translations before uploading', async () => {
    const withTranslations = {
      source: makeSource('file-1'),
      translations: [makeTranslation('file-1', 'es')],
    };
    const withoutTranslations = {
      source: makeSource('file-2'),
      translations: [],
    };

    mockGt.uploadTranslations.mockResolvedValue(
      uploadResults([confirmedUpload('file-1', 'es')])
    );

    const step = new UploadTranslationsStep(
      mockGt as unknown as GT,
      mockSettings
    );
    await step.run({ files: [withTranslations, withoutTranslations] });

    expect(mockGt.uploadTranslations).toHaveBeenCalledWith([withTranslations]);
  });

  it('skips the upload entirely when no files have translations', async () => {
    const step = new UploadTranslationsStep(
      mockGt as unknown as GT,
      mockSettings
    );
    const result = await step.run({
      files: [{ source: makeSource('file-1'), translations: [] }],
    });

    expect(result).toEqual([]);
    expect(mockGt.queryFiles).not.toHaveBeenCalled();
    expect(mockGt.uploadTranslations).not.toHaveBeenCalled();
  });

  it('skips translations whose content still matches the gt-lock.json hash', async () => {
    const unchanged = makeTranslation('file-1', 'es');
    const edited = makeTranslation('file-1', 'fr');
    mockLockfile([
      {
        fileId: 'file-1',
        versionId: 'version-file-1',
        translations: {
          es: { postProcessHash: hashStringSync(unchanged.content) },
          fr: { postProcessHash: hashStringSync('older fr content') },
        },
      },
    ]);
    mockGt.uploadTranslations.mockResolvedValue(
      uploadResults([confirmedUpload('file-1', 'fr')])
    );

    const step = new UploadTranslationsStep(
      mockGt as unknown as GT,
      mockSettings
    );
    await step.run({
      files: [
        { source: makeSource('file-1'), translations: [unchanged, edited] },
      ],
    });

    expect(mockGt.uploadTranslations).toHaveBeenCalledWith([
      { source: makeSource('file-1'), translations: [edited] },
    ]);
    expect(mockSpinner.stop).toHaveBeenCalledWith(
      expect.stringContaining('skipped 1 unchanged')
    );
  });

  it('uploads translations whose lock entry is for a stale source version', async () => {
    const translation = makeTranslation('file-1', 'es');
    mockLockfile([
      {
        fileId: 'file-1',
        versionId: 'old-version',
        translations: {
          es: { postProcessHash: hashStringSync(translation.content) },
        },
      },
    ]);
    mockGt.uploadTranslations.mockResolvedValue(
      uploadResults([confirmedUpload('file-1', 'es')])
    );

    const step = new UploadTranslationsStep(
      mockGt as unknown as GT,
      mockSettings
    );
    await step.run({
      files: [{ source: makeSource('file-1'), translations: [translation] }],
    });

    expect(mockGt.uploadTranslations).toHaveBeenCalledTimes(1);
  });

  it('skips the API call entirely when every translation matches the lockfile', async () => {
    const translation = makeTranslation('file-1', 'es');
    mockLockfile([
      {
        fileId: 'file-1',
        versionId: 'version-file-1',
        translations: {
          es: { postProcessHash: hashStringSync(translation.content) },
        },
      },
    ]);

    const step = new UploadTranslationsStep(
      mockGt as unknown as GT,
      mockSettings
    );
    const result = await step.run({
      files: [{ source: makeSource('file-1'), translations: [translation] }],
    });

    expect(result).toEqual([]);
    expect(mockGt.uploadTranslations).not.toHaveBeenCalled();
    expect(logger.info).toHaveBeenCalledWith(
      expect.stringContaining('unchanged since the last sync')
    );
  });

  it('records content hashes for server-confirmed uploads in the lockfile', async () => {
    const es = makeTranslation('file-1', 'es');
    const fr = makeTranslation('file-1', 'fr');
    mockGt.uploadTranslations.mockResolvedValue(
      uploadResults([
        confirmedUpload('file-1', 'es'),
        { ...confirmedUpload('file-1', 'fr'), status: 'failed', error: 'x' },
      ])
    );

    const step = new UploadTranslationsStep(
      mockGt as unknown as GT,
      mockSettings
    );
    await step.run({
      files: [{ source: makeSource('file-1'), translations: [es, fr] }],
    });

    expect(writeLockfile).toHaveBeenCalledTimes(1);
    const [written] = vi.mocked(writeLockfile).mock.calls[0]!;
    const entry = written.entries.find((e) => e.fileId === 'file-1');
    expect(entry?.translations.es?.postProcessHash).toBe(
      hashStringSync(es.content)
    );
    // Unconfirmed uploads must not be recorded, or they would be skipped
    // (and never retried) on the next run
    expect(entry?.translations.fr).toBeUndefined();
  });

  it('reports the server-confirmed number of uploaded translation files', async () => {
    const files = [
      {
        source: makeSource('file-1'),
        translations: [
          makeTranslation('file-1', 'es'),
          makeTranslation('file-1', 'fr'),
        ],
      },
      {
        source: makeSource('file-2'),
        translations: [makeTranslation('file-2', 'es')],
      },
    ];

    mockGt.uploadTranslations.mockResolvedValue(
      uploadResults([
        confirmedUpload('file-1', 'es'),
        confirmedUpload('file-1', 'fr'),
        confirmedUpload('file-2', 'es'),
      ])
    );

    const step = new UploadTranslationsStep(
      mockGt as unknown as GT,
      mockSettings
    );
    await step.run({ files });

    expect(mockSpinner.stop).toHaveBeenCalledWith(
      expect.stringContaining('Uploaded 3 translation files')
    );
    expect(logger.warn).not.toHaveBeenCalled();
  });

  it('warns about and records each translation the server failed to save', async () => {
    const files = [
      {
        source: makeSource('file-1'),
        translations: [
          makeTranslation('file-1', 'es'),
          makeTranslation('file-1', 'fr'),
        ],
      },
      {
        source: makeSource('file-2'),
        translations: [makeTranslation('file-2', 'es')],
      },
    ];

    // A 200 can carry per-item failures
    mockGt.uploadTranslations.mockResolvedValue(
      uploadResults([
        confirmedUpload('file-1', 'es'),
        {
          ...confirmedUpload('file-1', 'fr'),
          status: 'failed',
          error: 'invalid JSON',
        },
        confirmedUpload('file-2', 'es'),
      ])
    );

    const step = new UploadTranslationsStep(
      mockGt as unknown as GT,
      mockSettings
    );
    const result = await step.run({ files });

    expect(result).toHaveLength(2);
    expect(mockSpinner.stop).toHaveBeenCalledWith(
      expect.stringContaining('Uploaded 2 translation files')
    );
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('Failed to upload 1 translation file')
    );
    expect(logger.warn).toHaveBeenCalledWith(
      'Failed to upload fr/file-1.json: Translation for locale fr: invalid JSON'
    );
    expect(getWarnings()).toEqual([
      {
        category: 'failed_upload',
        fileName: 'fr/file-1.json',
        reason: 'Translation for locale fr: invalid JSON',
      },
    ]);
  });
});

describe('partitionTranslationsByLockfile', () => {
  it('uploads everything when the lockfile has no entries', () => {
    const files = [
      {
        source: makeSource('file-1'),
        translations: [makeTranslation('file-1', 'es')],
      },
    ];
    const { filesToUpload, skippedCount } = partitionTranslationsByLockfile(
      files,
      buildEntryMap([])
    );
    expect(filesToUpload).toEqual(files);
    expect(skippedCount).toBe(0);
  });

  it('uploads translations with a lock entry but no recorded hash', () => {
    const files = [
      {
        source: makeSource('file-1'),
        translations: [makeTranslation('file-1', 'es')],
      },
    ];
    const { filesToUpload, skippedCount } = partitionTranslationsByLockfile(
      files,
      buildEntryMap([
        {
          fileId: 'file-1',
          versionId: 'version-file-1',
          translations: { es: { updatedAt: '2026-07-14T00:00:00.000Z' } },
        },
      ])
    );
    expect(filesToUpload).toEqual(files);
    expect(skippedCount).toBe(0);
  });

  it('drops files entirely when all their translations are unchanged', () => {
    const unchanged = makeTranslation('file-1', 'es');
    const { filesToUpload, skippedCount } = partitionTranslationsByLockfile(
      [{ source: makeSource('file-1'), translations: [unchanged] }],
      buildEntryMap([
        {
          fileId: 'file-1',
          versionId: 'version-file-1',
          translations: {
            es: { postProcessHash: hashStringSync(unchanged.content) },
          },
        },
      ])
    );
    expect(filesToUpload).toEqual([]);
    expect(skippedCount).toBe(1);
  });
});
