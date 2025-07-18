import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  CheckFileTranslationData,
  checkFileTranslations,
} from '../checkFileTranslations.js';
import { gt } from '../../utils/gt.js';
import { downloadFile } from '../downloadFile.js';
import { createOraSpinner } from '../../console/logging.js';
import { Ora } from 'ora';
import {
  CheckFileTranslationsResult,
  CompletedFileTranslationData,
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
  // Common mock data factories
  const createMockSpinner = (): Ora =>
    ({
      text: '',
      succeed: vi.fn(),
      fail: vi.fn(),
      start: vi.fn(),
    }) as unknown as Ora;

  const createMockDownloadStatus = () => ({
    downloaded: new Set<string>(),
    failed: new Set<string>(),
  });

  const createMockResolveOutputPath = () =>
    vi.fn(
      (sourcePath: string, locale: string) =>
        `/output/${sourcePath}_${locale}.json`
    );

  const createMockFileData = (overrides: CheckFileTranslationData = {}) => ({
    'file1.json': { versionId: 'v1', fileName: 'file1.json' },
    ...overrides,
  });

  const createMockTranslation = (
    overrides: Partial<CompletedFileTranslationData> = {}
  ) => ({
    isReady: true,
    fileName: 'file1.json',
    locale: 'es',
    id: 'translation-1',
    metadata: {},
    fileId: 'file-1',
    versionId: 'v1',
    downloadUrl:
      'https://api.test.com/v1/project/translations/files/translation-1',
    ...overrides,
  });

  const createMockTranslationsResult = (
    translations: CompletedFileTranslationData[] = []
  ): CheckFileTranslationsResult => ({
    translations,
  });

  let mockSpinner: Ora;
  let mockDownloadStatus: ReturnType<typeof createMockDownloadStatus>;
  let mockResolveOutputPath: ReturnType<typeof createMockResolveOutputPath>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockSpinner = createMockSpinner();
    mockDownloadStatus = createMockDownloadStatus();
    mockResolveOutputPath = createMockResolveOutputPath();
    vi.mocked(createOraSpinner).mockResolvedValue(mockSpinner);
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
    const mockData = createMockFileData();
    const mockTranslation = createMockTranslation();
    const mockTranslationsResult = createMockTranslationsResult([
      mockTranslation,
    ]);

    vi.mocked(gt.checkFileTranslations).mockResolvedValue(
      mockTranslationsResult
    );
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
    const mockData = createMockFileData();
    const mockTranslation = createMockTranslation();
    const mockTranslations = createMockTranslationsResult([mockTranslation]);

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
    const mockData = createMockFileData();
    const mockTranslation = createMockTranslation();
    const mockTranslationsResult = createMockTranslationsResult([
      mockTranslation,
    ]);

    vi.mocked(gt.checkFileTranslations).mockResolvedValue(
      mockTranslationsResult
    );
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
