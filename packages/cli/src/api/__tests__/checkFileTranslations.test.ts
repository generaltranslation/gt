import { describe, it, expect, vi, beforeEach } from 'vitest';
import { checkFileTranslations } from '../checkFileTranslations.js';
import { gt } from '../../utils/gt.js';
import { downloadFile } from '../downloadFile.js';
import { createOraSpinner } from '../../console/logging.js';
import { Ora } from 'ora';
import {
  CheckFileTranslationsResult,
  FileTranslationQuery,
} from 'generaltranslation/types';

// Mock dependencies
vi.mock('../../utils/gt.js', () => ({
  gt: {
    checkFileTranslations: vi.fn(),
  },
}));

vi.mock('../downloadFile.js', () => ({
  downloadFile: vi.fn(),
}));

vi.mock('../downloadFileBatch.js', () => ({
  downloadFileBatch: vi.fn(),
}));

vi.mock('../../console/logging.js', () => ({
  createOraSpinner: vi.fn(),
  logError: vi.fn(),
}));

describe('checkFileTranslations', () => {
  const mockSpinner: Ora = {
    text: '',
    succeed: vi.fn(),
    fail: vi.fn(),
    start: vi.fn(),
  } as unknown as Ora;

  const mockDownloadStatus = {
    downloaded: new Set<string>(),
    failed: new Set<string>(),
  };

  const mockResolveOutputPath = vi.fn(
    (sourcePath: string, locale: string) =>
      `/output/${sourcePath}_${locale}.json`
  );

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(createOraSpinner).mockResolvedValue(mockSpinner);
    mockDownloadStatus.downloaded.clear();
    mockDownloadStatus.failed.clear();
  });

  it('should handle empty data', async () => {
    const mockData = {};

    const result = await checkFileTranslations(
      'project-123',
      'api-key',
      'https://api.test.com',
      mockData,
      ['es', 'fr'],
      30000,
      mockResolveOutputPath,
      mockDownloadStatus
    );

    expect(mockSpinner.start).toHaveBeenCalledWith(
      'Waiting for translation...'
    );
    expect(result).toBe(true);
  });

  it('should start spinner when called', async () => {
    const mockData = {
      'file1.json': { versionId: 'v1', fileName: 'file1.json' },
    };

    vi.mocked(gt.checkFileTranslations).mockResolvedValue({
      translations: [
        {
          isReady: true,
          fileName: 'file1.json',
          locale: 'es',
          id: 'translation-1',
          metadata: {},
          fileId: 'file-1',
          versionId: 'v1',
          downloadUrl:
            'https://api.test.com/v1/project/translations/files/translation-1',
        },
      ],
    });

    vi.mocked(downloadFile).mockResolvedValue(true);

    await checkFileTranslations(
      'project-123',
      'api-key',
      'https://api.test.com',
      mockData,
      ['es'],
      30000,
      mockResolveOutputPath,
      mockDownloadStatus
    );

    expect(mockSpinner.start).toHaveBeenCalledWith(
      'Waiting for translation...'
    );
  });

  it('should handle single file download', async () => {
    const mockData = {
      'file1.json': { versionId: 'v1', fileName: 'file1.json' },
    };

    const mockTranslations: CheckFileTranslationsResult = {
      translations: [
        {
          fileName: 'file1.json',
          versionId: 'v1',
          locale: 'es',
          metadata: {},
          fileId: 'file-1',
          id: 'translation-1',
          isReady: true,
          downloadUrl:
            'https://api.test.com/v1/project/translations/files/translation-1',
        },
      ],
    };

    vi.mocked(gt.checkFileTranslations).mockResolvedValue(mockTranslations);

    vi.mocked(downloadFile).mockResolvedValue(true);

    const result = await checkFileTranslations(
      'project-123',
      'api-key',
      'https://api.test.com',
      mockData,
      ['es'],
      30000,
      mockResolveOutputPath,
      mockDownloadStatus
    );

    expect(downloadFile).toHaveBeenCalledWith(
      'translation-1',
      '/output/file1.json_es.json'
    );
    expect(result).toBe(true);
  });

  it('should call gt.checkFileTranslations with correct parameters', async () => {
    const mockData = {
      'file1.json': { versionId: 'v1', fileName: 'file1.json' },
    };

    vi.mocked(gt.checkFileTranslations).mockResolvedValue({
      translations: [
        {
          isReady: true,
          fileName: 'file1.json',
          locale: 'es',
          id: 'translation-1',
          metadata: {},
          fileId: 'file-1',
          versionId: 'v1',
          downloadUrl:
            'https://api.test.com/v1/project/translations/files/translation-1',
        },
      ],
    });

    vi.mocked(downloadFile).mockResolvedValue(true);

    await checkFileTranslations(
      'project-123',
      'api-key',
      'https://api.test.com',
      mockData,
      ['es'],
      30000,
      mockResolveOutputPath,
      mockDownloadStatus
    );

    expect(gt.checkFileTranslations).toHaveBeenCalledWith([
      { versionId: 'v1', fileName: 'file1.json', locale: 'es' },
    ]);
  });
});
