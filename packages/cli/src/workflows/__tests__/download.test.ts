import { beforeEach, describe, expect, it, vi } from 'vitest';
import path from 'node:path';
import { downloadFileBatch } from '../../api/downloadFileBatch.js';
import { createMockSettings } from '../../api/__mocks__/settings.js';
import { clearLocaleDirs } from '../../fs/clearLocaleDirs.js';
import type { BranchData } from '../../types/branch.js';
import type { Settings } from '../../types/index.js';
import { gt } from '../../utils/gt.js';
import { runDownloadWorkflow } from '../download.js';

vi.mock('../../utils/gt.js', () => ({
  gt: {
    queryFileData: vi.fn(),
    resolveAliasLocale: vi.fn((locale: string) => locale),
  },
}));

vi.mock('../../fs/clearLocaleDirs.js', () => ({
  clearLocaleDirs: vi.fn(),
}));

vi.mock('../../api/downloadFileBatch.js', () => ({
  downloadFileBatch: vi.fn(),
}));

vi.mock('../../console/logger.js', () => ({
  logger: {
    error: vi.fn(),
    warn: vi.fn(),
    createProgressBar: vi.fn(() => ({
      start: vi.fn(),
      stop: vi.fn(),
      advance: vi.fn(),
    })),
    createSpinner: vi.fn(() => ({
      start: vi.fn(),
      stop: vi.fn(),
    })),
  },
}));

describe('runDownloadWorkflow', () => {
  const branchData: BranchData = {
    currentBranch: { id: 'branch-1', name: 'main' },
    incomingBranch: null,
    checkedOutBranch: null,
  };

  const settings = createMockSettings({
    config: path.join('/tmp/project', 'gt.config.json'),
    locales: ['es'],
    options: {
      experimentalClearLocaleDirs: true,
    },
  }) as Settings;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(downloadFileBatch).mockResolvedValue({
      successful: [],
      failed: [],
      skipped: [],
    });
  });

  it('does not clear locale directories for translations that are not completed', async () => {
    vi.mocked(gt.queryFileData).mockResolvedValue({
      translatedFiles: [],
    });

    await runDownloadWorkflow({
      fileVersionData: {
        'file-1': {
          versionId: 'version-1',
          fileName: 'messages/en.json',
        },
      },
      jobData: {
        jobData: {},
        locales: ['es'],
        message: '',
      },
      branchData,
      locales: ['es'],
      timeoutDuration: 1,
      resolveOutputPath: () => 'messages/es.json',
      options: settings,
    });

    expect(clearLocaleDirs).not.toHaveBeenCalled();
    expect(downloadFileBatch).not.toHaveBeenCalled();
  });

  it('clears locale directories after translations are confirmed completed', async () => {
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
      fileVersionData: {
        'file-1': {
          versionId: 'version-1',
          fileName: 'messages/en.json',
        },
      },
      jobData: {
        jobData: {},
        locales: ['es'],
        message: '',
      },
      branchData,
      locales: ['es'],
      timeoutDuration: 1,
      resolveOutputPath: () => 'messages/es.json',
      options: settings,
    });

    expect(clearLocaleDirs).toHaveBeenCalledTimes(1);
    expect(clearLocaleDirs).toHaveBeenCalledWith(
      new Set(['messages/es.json']),
      ['es'],
      undefined,
      '/tmp/project'
    );
    expect(downloadFileBatch).toHaveBeenCalledTimes(1);
  });
});
