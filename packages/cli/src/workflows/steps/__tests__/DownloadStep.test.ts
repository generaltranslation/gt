import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { GT } from 'generaltranslation';
import type { Settings } from '../../../types/index.js';
import { downloadFileBatch } from '../../../api/downloadFileBatch.js';
import { logger } from '../../../console/logger.js';
import {
  clearWarnings,
  getWarnings,
} from '../../../state/translateWarnings.js';
import { DownloadTranslationsStep } from '../DownloadStep.js';

vi.mock('../../../console/logger.js', () => ({
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

vi.mock('../../../api/downloadFileBatch.js', () => ({
  downloadFileBatch: vi.fn(),
}));

describe('DownloadTranslationsStep', () => {
  const mockGt = {
    queryFileData: vi.fn(),
  };

  const mockSettings = {};

  beforeEach(() => {
    vi.clearAllMocks();
    clearWarnings();
  });

  it('shows a warning stop message when every completed file is missing', async () => {
    mockGt.queryFileData.mockResolvedValue({
      translatedFiles: [],
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
