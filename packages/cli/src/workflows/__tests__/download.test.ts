import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Settings } from '../../types/index.js';
import { clearLocaleDirs } from '../../fs/clearLocaleDirs.js';
import { gt } from '../../utils/gt.js';
import { downloadFileBatch } from '../../api/downloadFileBatch.js';
import { runDownloadWorkflow } from '../download.js';

vi.mock('../../console/logger.js', () => ({
  logger: {
    warn: vi.fn(),
    error: vi.fn(),
    createProgressBar: vi.fn(() => ({
      start: vi.fn(),
      stop: vi.fn(),
      advance: vi.fn(),
    })),
  },
}));

vi.mock('../../fs/clearLocaleDirs.js', () => ({
  clearLocaleDirs: vi.fn(),
}));

vi.mock('../../utils/gt.js', () => ({
  gt: {
    queryFileData: vi.fn(),
    resolveAliasLocale: vi.fn((locale: string) => locale),
  },
}));

vi.mock('../../api/downloadFileBatch.js', () => ({
  downloadFileBatch: vi.fn(),
}));

describe('runDownloadWorkflow', () => {
  const settings = {
    config: '/project/gt.config.json',
    options: {
      experimentalClearLocaleDirs: true,
    },
  } as Settings;

  const branchData = {
    currentBranch: { id: 'branch-1', name: 'main' },
    incomingBranch: null,
    checkedOutBranch: null,
  };

  const fileVersionData = {
    'file-1': {
      versionId: 'version-1',
      fileName: 'messages/en.json',
    },
  };

  const jobData = {
    jobData: {},
    locales: ['es'],
    message: 'No files need to be enqueued',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(downloadFileBatch).mockResolvedValue({
      successful: [],
      failed: [],
      skipped: [],
    });
  });

  it('does not clear locale dirs when no translations are completed', async () => {
    vi.mocked(gt.queryFileData).mockResolvedValue({
      translatedFiles: [],
    });

    await runDownloadWorkflow({
      fileVersionData,
      jobData,
      branchData,
      locales: ['es'],
      timeoutDuration: 1,
      resolveOutputPath: (_sourcePath, locale) => `messages/${locale}.json`,
      options: settings,
    });

    expect(clearLocaleDirs).not.toHaveBeenCalled();
    expect(downloadFileBatch).not.toHaveBeenCalled();
  });

  it('clears locale dirs only after translations are confirmed completed', async () => {
    vi.mocked(gt.queryFileData).mockResolvedValue({
      translatedFiles: [
        {
          branchId: 'branch-1',
          fileId: 'file-1',
          versionId: 'version-1',
          locale: 'es',
          completedAt: '2026-01-01T00:00:00.000Z',
        },
      ],
    });

    await runDownloadWorkflow({
      fileVersionData,
      jobData,
      branchData,
      locales: ['es'],
      timeoutDuration: 1,
      resolveOutputPath: (_sourcePath, locale) => `messages/${locale}.json`,
      options: settings,
    });

    expect(clearLocaleDirs).toHaveBeenCalledTimes(1);
    const [translatedFiles, locales, exclude, cwd] =
      vi.mocked(clearLocaleDirs).mock.calls[0];
    expect([...translatedFiles]).toEqual(['messages/es.json']);
    expect(locales).toEqual(['es']);
    expect(exclude).toBeUndefined();
    expect(cwd).toBe('/project');
    expect(downloadFileBatch).toHaveBeenCalledTimes(1);
    const [, downloadSettings] = vi.mocked(downloadFileBatch).mock.calls[0];
    expect(downloadSettings).toEqual(
      expect.objectContaining({ _branchId: 'branch-1' })
    );
    expect(downloadSettings).not.toBe(settings);
    expect(settings._branchId).toBeUndefined();
  });

  it('reuses known completed translation keys instead of querying status', async () => {
    await runDownloadWorkflow({
      fileVersionData,
      jobData,
      completedTranslationKeys: new Set(['branch-1:file-1:version-1:es']),
      branchData,
      locales: ['es'],
      timeoutDuration: 1,
      resolveOutputPath: (_sourcePath, locale) => `messages/${locale}.json`,
      options: settings,
    });

    expect(gt.queryFileData).not.toHaveBeenCalled();
    expect(downloadFileBatch).toHaveBeenCalledTimes(1);
  });
});
