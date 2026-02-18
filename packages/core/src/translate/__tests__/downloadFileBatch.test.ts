import { describe, it, expect, vi, beforeEach } from 'vitest';
import _downloadFileBatch from '../downloadFileBatch';
import apiRequest from '../utils/apiRequest';
import { TranslationRequestConfig } from '../../types';
import {
  DownloadFileBatchOptions,
  DownloadFileBatchRequest,
  DownloadFileBatchResult,
} from '../../types-dir/api/downloadFileBatch';

vi.mock('../utils/apiRequest');

describe.sequential('_downloadFileBatch', () => {
  const mockConfig: TranslationRequestConfig = {
    baseUrl: 'https://api.test.com',
    projectId: 'test-project',
    apiKey: 'test-api-key',
  };

  const mockDownloadFileBatchResult: DownloadFileBatchResult = {
    files: [
      {
        id: 'translation-1',
        branchId: 'branch-1',
        fileId: 'file-1',
        versionId: 'version-1',
        fileFormat: 'JSON',
        fileName: 'file1.json',
        data: 'file content 1',
        metadata: { contentType: 'application/json' },
      },
      {
        id: 'translation-2',
        branchId: 'branch-2',
        fileId: 'file-2',
        versionId: 'version-2',
        fileFormat: 'JSON',
        fileName: 'file2.json',
        data: '',
        metadata: { error: 'File not found' },
      },
    ],
    count: 2,
  };
  const mockDownloadFileBatchResultBase64: DownloadFileBatchResult = {
    files: [
      {
        id: 'translation-1',
        branchId: 'branch-1',
        fileId: 'file-1',
        versionId: 'version-1',
        fileFormat: 'JSON',
        fileName: 'file1.json',
        data: Buffer.from('file content 1').toString('base64'),
        metadata: { contentType: 'application/json' },
      },
      {
        id: 'translation-2',
        branchId: 'branch-2',
        fileId: 'file-2',
        versionId: 'version-2',
        fileFormat: 'JSON',
        fileName: 'file2.json',
        data: '',
        metadata: { error: 'File not found' },
      },
    ],
    count: 2,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should download multiple files in batch successfully', async () => {
    vi.mocked(apiRequest).mockResolvedValue(
      mockDownloadFileBatchResultBase64
    );

    const files: DownloadFileBatchRequest = [
      { fileId: 'file-1', branchId: 'branch-1', versionId: 'version-1' },
      { fileId: 'file-2', branchId: 'branch-2', versionId: 'version-2' },
    ];

    const options: DownloadFileBatchOptions = {
      timeout: 5000,
    };

    const result = await _downloadFileBatch(files, options, mockConfig);

    expect(apiRequest).toHaveBeenCalledWith(
      mockConfig,
      '/v2/project/files/download',
      {
        body: [
          { fileId: 'file-1', branchId: 'branch-1', versionId: 'version-1' },
          { fileId: 'file-2', branchId: 'branch-2', versionId: 'version-2' },
        ],
        timeout: 5000,
      }
    );
    expect(result.data).toEqual(mockDownloadFileBatchResult.files);
    expect(result.count).toBe(2);
    expect(result.batchCount).toBe(1);
  });

  it('should handle single file in batch', async () => {
    vi.mocked(apiRequest).mockResolvedValue(
      mockDownloadFileBatchResultBase64
    );

    const files: DownloadFileBatchRequest = [
      { fileId: 'file-1', branchId: 'branch-1', versionId: 'version-1' },
    ];

    const options: DownloadFileBatchOptions = {};

    const result = await _downloadFileBatch(files, options, mockConfig);

    expect(apiRequest).toHaveBeenCalledWith(
      mockConfig,
      '/v2/project/files/download',
      {
        body: [
          { fileId: 'file-1', branchId: 'branch-1', versionId: 'version-1' },
        ],
        timeout: undefined,
      }
    );
    expect(result.data).toEqual(mockDownloadFileBatchResult.files);
    expect(result.batchCount).toBe(1);
  });

  it('should use default timeout when not specified', async () => {
    vi.mocked(apiRequest).mockResolvedValue(
      mockDownloadFileBatchResultBase64
    );

    const files: DownloadFileBatchRequest = [
      { fileId: 'file-1', branchId: 'branch-1', versionId: 'version-1' },
    ];

    const options: DownloadFileBatchOptions = {};

    await _downloadFileBatch(files, options, mockConfig);

    expect(apiRequest).toHaveBeenCalledWith(
      expect.any(Object),
      expect.any(String),
      expect.objectContaining({ timeout: undefined })
    );
  });

  it('should respect custom timeout', async () => {
    vi.mocked(apiRequest).mockResolvedValue(
      mockDownloadFileBatchResultBase64
    );

    const files: DownloadFileBatchRequest = [
      { fileId: 'file-1', branchId: 'branch-1', versionId: 'version-1' },
    ];

    const options: DownloadFileBatchOptions = {
      timeout: 99999,
    };

    await _downloadFileBatch(files, options, mockConfig);

    expect(apiRequest).toHaveBeenCalledWith(
      expect.any(Object),
      expect.any(String),
      expect.objectContaining({ timeout: 99999 })
    );
  });

  it('should use default URL when baseUrl not provided in config', async () => {
    vi.mocked(apiRequest).mockResolvedValue(
      mockDownloadFileBatchResultBase64
    );

    const configWithoutUrl: TranslationRequestConfig = {
      projectId: 'test-project',
      apiKey: 'test-api-key',
    };

    const files: DownloadFileBatchRequest = [
      { fileId: 'file-1', branchId: 'branch-1', versionId: 'version-1' },
    ];

    const options: DownloadFileBatchOptions = {};

    await _downloadFileBatch(files, options, configWithoutUrl);

    expect(apiRequest).toHaveBeenCalledWith(
      configWithoutUrl,
      '/v2/project/files/download',
      expect.any(Object)
    );
  });

  it('should handle fetch errors', async () => {
    const fetchError = new Error('Network error');
    vi.mocked(apiRequest).mockRejectedValue(fetchError);

    const files: DownloadFileBatchRequest = [
      { fileId: 'file-1', branchId: 'branch-1', versionId: 'version-1' },
    ];

    const options: DownloadFileBatchOptions = {};

    await expect(
      _downloadFileBatch(files, options, mockConfig)
    ).rejects.toThrow('Network error');
  });

  it('should handle validation errors', async () => {
    vi.mocked(apiRequest).mockRejectedValue(new Error('Validation failed'));

    const files: DownloadFileBatchRequest = [
      { fileId: 'file-1', branchId: 'branch-1', versionId: 'version-1' },
    ];

    const options: DownloadFileBatchOptions = {};

    await expect(
      _downloadFileBatch(files, options, mockConfig)
    ).rejects.toThrow('Validation failed');
  });

  it('should handle empty files array', async () => {
    const files: DownloadFileBatchRequest = [];

    const options: DownloadFileBatchOptions = {};

    const result = await _downloadFileBatch(files, options, mockConfig);

    // With batching, empty array returns early without making any API calls
    expect(apiRequest).not.toHaveBeenCalled();
    expect(result.data).toEqual([]);
    expect(result.count).toBe(0);
    expect(result.batchCount).toBe(0);
  });

  it('should include fileIds in request body', async () => {
    vi.mocked(apiRequest).mockResolvedValue(
      mockDownloadFileBatchResultBase64
    );

    const files: DownloadFileBatchRequest = [
      { fileId: 'file-1', branchId: 'branch-1', versionId: 'version-1' },
    ];

    const options: DownloadFileBatchOptions = {};

    await _downloadFileBatch(files, options, mockConfig);

    expect(apiRequest).toHaveBeenCalledWith(
      expect.any(Object),
      expect.any(String),
      expect.objectContaining({
        body: [
          { fileId: 'file-1', branchId: 'branch-1', versionId: 'version-1' },
        ],
      })
    );
  });

  it('should map fileIds correctly in request body', async () => {
    vi.mocked(apiRequest).mockResolvedValue(
      mockDownloadFileBatchResultBase64
    );

    const files: DownloadFileBatchRequest = [
      { fileId: 'file-1', branchId: 'branch-1', versionId: 'version-1' },
      { fileId: 'file-2', branchId: 'branch-2', versionId: 'version-2' },
    ];

    const options: DownloadFileBatchOptions = {};

    await _downloadFileBatch(files, options, mockConfig);

    expect(apiRequest).toHaveBeenCalledWith(
      expect.any(Object),
      expect.any(String),
      expect.objectContaining({
        body: [
          { fileId: 'file-1', branchId: 'branch-1', versionId: 'version-1' },
          { fileId: 'file-2', branchId: 'branch-2', versionId: 'version-2' },
        ],
      })
    );
  });

  it('should batch files when downloading more than 100 files', async () => {
    // Create 150 mock file requests
    const files: DownloadFileBatchRequest = Array.from(
      { length: 150 },
      (_, i) => ({
        fileId: `file-${i}`,
        branchId: `branch-${i}`,
        versionId: `version-${i}`,
      })
    );

    const mockResponse1: DownloadFileBatchResult = {
      files: Array.from({ length: 100 }, (_, i) => ({
        id: `translation-${i}`,
        branchId: `branch-${i}`,
        fileId: `file-${i}`,
        versionId: `version-${i}`,
        fileFormat: 'JSON',
        fileName: `file-${i}.json`,
        data: Buffer.from(`content ${i}`).toString('base64'),
        metadata: {},
      })),
      count: 100,
    };

    const mockResponse2: DownloadFileBatchResult = {
      files: Array.from({ length: 50 }, (_, i) => ({
        id: `translation-${i + 100}`,
        branchId: `branch-${i + 100}`,
        fileId: `file-${i + 100}`,
        versionId: `version-${i + 100}`,
        fileFormat: 'JSON',
        fileName: `file-${i + 100}.json`,
        data: Buffer.from(`content ${i + 100}`).toString('base64'),
        metadata: {},
      })),
      count: 50,
    };

    vi.mocked(apiRequest)
      .mockResolvedValueOnce(mockResponse1)
      .mockResolvedValueOnce(mockResponse2);

    const options: DownloadFileBatchOptions = {};

    const result = await _downloadFileBatch(files, options, mockConfig);

    // Should make 2 batch calls
    expect(apiRequest).toHaveBeenCalledTimes(2);

    // Result should contain all 150 files
    expect(result.data).toHaveLength(150);
    expect(result.count).toBe(150);
    expect(result.batchCount).toBe(2);
  });
});
