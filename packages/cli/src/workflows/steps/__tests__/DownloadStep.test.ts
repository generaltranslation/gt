import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError, ErrorCode } from 'generaltranslation/api';
import path from 'node:path';
import type { GT } from 'generaltranslation';
import type { Settings } from '../../../types/index.js';
import { downloadFileBatch } from '../../../api/downloadFileBatch.js';
import { logger } from '../../../console/logger.js';
import {
  clearWarnings,
  getWarnings,
} from '../../../state/translateWarnings.js';
import { DownloadTranslationsStep } from '../DownloadStep.js';
import { TEMPLATE_FILE_NAME } from '../../../utils/constants.js';

vi.mock('../../../console/logger.js', () => ({
  logger: {
    warn: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    createProgressBar: vi.fn(() => ({
      start: vi.fn(),
      stop: vi.fn(),
      advance: vi.fn(),
    })),
  },
}));

vi.mock('../../../api/downloadFileBatch.js', () => ({
  downloadFileBatch: vi.fn(),
}));

describe('DownloadTranslationsStep', () => {
  const mockGt = {
    queryFiles: vi.fn(),
  };

  const mockSettings = {};

  beforeEach(() => {
    vi.clearAllMocks();
    clearWarnings();
  });

  it('shows a warning stop message when every completed file is missing', async () => {
    mockGt.queryFiles.mockResolvedValue({
      results: [{ status: 'pending', fileId: 'file-1', locale: 'fr' }],
    });

    const fileTracker = {
      completed: new Map([
        [
          'branch-1:file-1:version-1:fr',
          {
            branchId: 'branch-1',
            fileId: 'file-1',
            versionId: 'version-1',
            locale: 'fr',
            fileName: 'messages.json',
          },
        ],
      ]),
      inProgress: new Map(),
      failed: new Map(),
      skipped: new Map(),
    };

    const step = new DownloadTranslationsStep(
      mockGt as unknown as GT,
      mockSettings as Settings
    );
    const success = await step.run({
      fileTracker,
      resolveOutputPath: () => 'out/messages.fr.json',
    });

    expect(success).toBe(true);
    expect(downloadFileBatch).not.toHaveBeenCalled();
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('Failed to download 1 file(s)')
    );

    const progressBar = vi.mocked(logger.createProgressBar).mock.results[0]
      ?.value;

    expect(progressBar?.stop).toHaveBeenCalledTimes(1);
    expect(progressBar?.stop).toHaveBeenCalledWith(
      expect.stringContaining('No files downloaded')
    );
    expect(getWarnings()).toEqual([
      {
        category: 'failed_download',
        fileName: 'messages.json',
        reason: 'Failed to download for locale fr',
      },
    ]);
  });
});

describe('DownloadTranslationsStep review gating', () => {
  const mockGt = {
    queryFiles: vi.fn(),
  };

  const makeTracker = (fileName: string) => ({
    completed: new Map([
      [
        'branch-1:file-1:version-1:fr',
        {
          branchId: 'branch-1',
          fileId: 'file-1',
          versionId: 'version-1',
          locale: 'fr',
          fileName,
        },
      ],
    ]),
    inProgress: new Map(),
    failed: new Map(),
    skipped: new Map(),
  });

  const makeTranslation = (approvedAt: string | null) => ({
    status: 'found',
    branchId: 'branch-1',
    fileId: 'file-1',
    versionId: 'version-1',
    locale: 'fr',
    completedAt: '2026-07-01T00:00:00Z',
    approvedAt,
    publishedAt: null,
    createdAt: '2026-07-01T00:00:00Z',
    updatedAt: '2026-07-01T00:00:00Z',
    fileFormat: 'JSON',
    dataFormat: 'STRING',
  });

  const makeSettings = (reviewPaths: string[]) =>
    ({
      files: {
        requiresReviewPaths: new Set(
          reviewPaths.map((p) => path.resolve(process.cwd(), p))
        ),
      },
    }) as unknown as Settings;

  const runStep = async (
    fileName: string,
    approvedAt: string | null,
    reviewPaths: string[]
  ) => {
    mockGt.queryFiles.mockResolvedValue({
      results: [makeTranslation(approvedAt)],
    });
    vi.mocked(downloadFileBatch).mockResolvedValue({
      successful: [{ inputPath: fileName, locale: 'fr' }],
      failed: [],
      skipped: [],
      retryable: [],
    } as unknown as Awaited<ReturnType<typeof downloadFileBatch>>);

    const fileTracker = makeTracker(fileName);
    const step = new DownloadTranslationsStep(
      mockGt as unknown as GT,
      makeSettings(reviewPaths)
    );
    const success = await step.run({
      fileTracker,
      resolveOutputPath: (sourcePath, locale) => `out/${locale}/${sourcePath}`,
    });
    return { success, fileTracker };
  };

  beforeEach(() => {
    vi.clearAllMocks();
    clearWarnings();
  });

  it('skips unapproved review-gated files without failing', async () => {
    const { success, fileTracker } = await runStep('messages.json', null, [
      'messages.json',
    ]);

    expect(success).toBe(true);
    expect(downloadFileBatch).not.toHaveBeenCalled();
    expect(fileTracker.completed.size).toBe(0);
    expect(fileTracker.skipped.size).toBe(1);
    expect(logger.warn).not.toHaveBeenCalled();
    expect(getWarnings()).toEqual([
      {
        category: 'pending_review',
        fileName: 'messages.json',
        reason:
          'Translation for locale fr requires review and is not approved yet',
      },
    ]);
  });

  it('downloads approved review-gated files', async () => {
    const { success, fileTracker } = await runStep(
      'messages.json',
      '2026-07-01T01:00:00Z',
      ['messages.json']
    );

    expect(success).toBe(true);
    expect(downloadFileBatch).toHaveBeenCalledTimes(1);
    expect(fileTracker.skipped.size).toBe(0);
  });

  it('downloads unapproved files that do not require review', async () => {
    const { success, fileTracker } = await runStep('messages.json', null, [
      'other.json',
    ]);

    expect(success).toBe(true);
    expect(downloadFileBatch).toHaveBeenCalledTimes(1);
    expect(fileTracker.skipped.size).toBe(0);
  });

  it('always downloads GTJSON regardless of approval state', async () => {
    const { success, fileTracker } = await runStep(TEMPLATE_FILE_NAME, null, [
      TEMPLATE_FILE_NAME,
    ]);

    expect(success).toBe(true);
    expect(downloadFileBatch).toHaveBeenCalledTimes(1);
    expect(fileTracker.skipped.size).toBe(0);
  });
});

describe('DownloadTranslationsStep retries', () => {
  const mockGt = { queryFiles: vi.fn() };
  const file = {
    branchId: 'branch-1',
    fileId: 'file-1',
    versionId: 'version-1',
    locale: 'fr',
    fileName: 'messages.json',
  };
  const batched = {
    branchId: 'branch-1',
    fileId: 'file-1',
    versionId: 'version-1',
    locale: 'fr',
    inputPath: 'messages.json',
    outputPath: 'out/fr/messages.json',
  };
  const found = {
    results: [
      {
        status: 'found',
        ...file,
        completedAt: '2026-07-01T00:00:00Z',
        approvedAt: null,
      },
    ],
  };
  const batchResult = (
    result: Partial<Awaited<ReturnType<typeof downloadFileBatch>>>
  ) => ({ successful: [], failed: [], skipped: [], retryable: [], ...result });

  const runStep = async () => {
    const run = new DownloadTranslationsStep(
      mockGt as unknown as GT,
      {} as Settings
    ).run({
      fileTracker: {
        completed: new Map([['branch-1:file-1:version-1:fr', file]]),
        inProgress: new Map(),
        failed: new Map(),
        skipped: new Map(),
      },
      resolveOutputPath: () => batched.outputPath,
    });
    await vi.runAllTimersAsync();
    return run;
  };

  beforeEach(() => {
    vi.clearAllMocks();
    clearWarnings();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('reads the translation metadata again after a transient failure', async () => {
    mockGt.queryFiles
      .mockRejectedValueOnce(
        new ApiError('Unavailable', 503, ErrorCode.UNAVAILABLE)
      )
      .mockResolvedValueOnce(found);
    vi.mocked(downloadFileBatch).mockResolvedValue(
      batchResult({ successful: [batched] })
    );

    expect(await runStep()).toBe(true);
    expect(mockGt.queryFiles).toHaveBeenCalledTimes(2);
    expect(downloadFileBatch).toHaveBeenCalledTimes(1);
  });

  it('does not read the metadata again after a permanent failure', async () => {
    mockGt.queryFiles.mockRejectedValue(
      new ApiError('Missing permission', 403, ErrorCode.PERMISSION_MISSING)
    );

    expect(await runStep()).toBe(false);
    expect(mockGt.queryFiles).toHaveBeenCalledTimes(1);
    expect(downloadFileBatch).not.toHaveBeenCalled();
  });

  it('requests retryable files again and reports what never downloaded', async () => {
    mockGt.queryFiles.mockResolvedValue(found);
    vi.mocked(downloadFileBatch).mockResolvedValue(
      batchResult({ retryable: [batched] })
    );

    expect(await runStep()).toBe(true);
    // The first request and three retries
    expect(downloadFileBatch).toHaveBeenCalledTimes(4);
    expect(getWarnings()).toEqual([
      {
        category: 'failed_download',
        fileName: 'messages.json',
        reason: 'Failed to download for locale fr',
      },
    ]);
  });

  it('does not request failed files again', async () => {
    mockGt.queryFiles.mockResolvedValue(found);
    vi.mocked(downloadFileBatch).mockResolvedValue(
      batchResult({ failed: [batched] })
    );

    expect(await runStep()).toBe(true);
    expect(downloadFileBatch).toHaveBeenCalledTimes(1);
  });
});
