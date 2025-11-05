import { describe, it, expect, vi, beforeEach } from 'vitest';
import _downloadFileBatch from '../downloadFileBatch';
import fetchWithTimeout from '../utils/fetchWithTimeout';
import validateResponse from '../utils/validateResponse';
import handleFetchError from '../utils/handleFetchError';
import generateRequestHeaders from '../utils/generateRequestHeaders';
import { TranslationRequestConfig } from '../../types';
import {
  DownloadFileBatchOptions,
  DownloadFileBatchRequest,
  DownloadFileBatchResult,
} from '../../types-dir/api/downloadFileBatch';

vi.mock('../utils/fetchWithTimeout');
vi.mock('../utils/validateResponse');
vi.mock('../utils/handleFetchError');
vi.mock('../utils/generateRequestHeaders');

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
    vi.mocked(generateRequestHeaders).mockReturnValue({
      'Content-Type': 'application/json',
      'x-gt-api-key': 'test-api-key',
      'x-gt-project-id': 'test-project',
    });
  });

  it('should download multiple files in batch successfully', async () => {
    const mockResponse = {
      json: vi.fn().mockResolvedValue(mockDownloadFileBatchResultBase64),
    } as unknown as Response;

    vi.mocked(fetchWithTimeout).mockResolvedValue(mockResponse);
    vi.mocked(validateResponse).mockResolvedValue(undefined);

    const files: DownloadFileBatchRequest = [
      { fileId: 'file-1', branchId: 'branch-1', versionId: 'version-1' },
      { fileId: 'file-2', branchId: 'branch-2', versionId: 'version-2' },
    ];

    const options: DownloadFileBatchOptions = {
      timeout: 5000,
    };

    const result = await _downloadFileBatch(files, options, mockConfig);

    expect(fetchWithTimeout).toHaveBeenCalledWith(
      'https://api.test.com/v2/project/files/download',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-gt-api-key': 'test-api-key',
          'x-gt-project-id': 'test-project',
        },
        body: JSON.stringify([
          { fileId: 'file-1', branchId: 'branch-1', versionId: 'version-1' },
          { fileId: 'file-2', branchId: 'branch-2', versionId: 'version-2' },
        ]),
      },
      5000
    );
    expect(validateResponse).toHaveBeenCalledWith(mockResponse);
    expect(result.data).toEqual(mockDownloadFileBatchResult.files);
    expect(result.count).toBe(2);
    expect(result.batchCount).toBe(1);
  });

  it('should handle single file in batch', async () => {
    const mockResponse = {
      json: vi.fn().mockResolvedValue(mockDownloadFileBatchResultBase64),
    } as unknown as Response;

    vi.mocked(fetchWithTimeout).mockResolvedValue(mockResponse);
    vi.mocked(validateResponse).mockResolvedValue(undefined);

    const files: DownloadFileBatchRequest = [
      { fileId: 'file-1', branchId: 'branch-1', versionId: 'version-1' },
    ];

    const options: DownloadFileBatchOptions = {};

    const result = await _downloadFileBatch(files, options, mockConfig);

    expect(fetchWithTimeout).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        body: JSON.stringify([
          { fileId: 'file-1', branchId: 'branch-1', versionId: 'version-1' },
        ]),
      }),
      60000
    );
    expect(result.data).toEqual(mockDownloadFileBatchResult.files);
    expect(result.batchCount).toBe(1);
  });

  it('should use default timeout when not specified', async () => {
    const mockResponse = {
      json: vi.fn().mockResolvedValue(mockDownloadFileBatchResultBase64),
    } as unknown as Response;

    vi.mocked(fetchWithTimeout).mockResolvedValue(mockResponse);
    vi.mocked(validateResponse).mockResolvedValue(undefined);

    const files: DownloadFileBatchRequest = [
      { fileId: 'file-1', branchId: 'branch-1', versionId: 'version-1' },
    ];

    const options: DownloadFileBatchOptions = {};

    await _downloadFileBatch(files, options, mockConfig);

    expect(fetchWithTimeout).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(Object),
      60000
    );
  });

  it('should enforce maximum timeout limit', async () => {
    const mockResponse = {
      json: vi.fn().mockResolvedValue(mockDownloadFileBatchResultBase64),
    } as unknown as Response;

    vi.mocked(fetchWithTimeout).mockResolvedValue(mockResponse);
    vi.mocked(validateResponse).mockResolvedValue(undefined);

    const files: DownloadFileBatchRequest = [
      { fileId: 'file-1', branchId: 'branch-1', versionId: 'version-1' },
    ];

    const options: DownloadFileBatchOptions = {
      timeout: 99999,
    };

    await _downloadFileBatch(files, options, mockConfig);

    expect(fetchWithTimeout).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(Object),
      60000
    );
  });

  it('should use default URL when baseUrl not provided in config', async () => {
    const mockResponse = {
      json: vi.fn().mockResolvedValue(mockDownloadFileBatchResultBase64),
    } as unknown as Response;

    vi.mocked(fetchWithTimeout).mockResolvedValue(mockResponse);
    vi.mocked(validateResponse).mockResolvedValue(undefined);

    const configWithoutUrl: TranslationRequestConfig = {
      projectId: 'test-project',
      apiKey: 'test-api-key',
    };

    const files: DownloadFileBatchRequest = [
      { fileId: 'file-1', branchId: 'branch-1', versionId: 'version-1' },
    ];

    const options: DownloadFileBatchOptions = {};

    await _downloadFileBatch(files, options, configWithoutUrl);

    expect(fetchWithTimeout).toHaveBeenCalledWith(
      expect.stringContaining('https://api2.gtx.dev/v2/project/files/download'),
      expect.any(Object),
      expect.any(Number)
    );
  });

  it('should handle fetch errors through handleFetchError', async () => {
    const fetchError = new Error('Network error');
    vi.mocked(fetchWithTimeout).mockRejectedValue(fetchError);
    vi.mocked(handleFetchError).mockImplementation(() => {
      throw fetchError;
    });

    const files: DownloadFileBatchRequest = [
      { fileId: 'file-1', branchId: 'branch-1', versionId: 'version-1' },
    ];

    const options: DownloadFileBatchOptions = {};

    await expect(
      _downloadFileBatch(files, options, mockConfig)
    ).rejects.toThrow('Network error');
    expect(handleFetchError).toHaveBeenCalledWith(fetchError, 60000);
  });

  it('should handle validation errors', async () => {
    const mockResponse = {
      json: vi.fn().mockResolvedValue(mockDownloadFileBatchResultBase64),
    } as unknown as Response;

    vi.mocked(fetchWithTimeout).mockResolvedValue(mockResponse);
    vi.mocked(validateResponse).mockImplementationOnce(() => {
      throw new Error('Validation failed');
    });

    const files: DownloadFileBatchRequest = [
      { fileId: 'file-1', branchId: 'branch-1', versionId: 'version-1' },
    ];

    const options: DownloadFileBatchOptions = {};

    await expect(
      _downloadFileBatch(files, options, mockConfig)
    ).rejects.toThrow('Validation failed');
    expect(validateResponse).toHaveBeenCalledWith(mockResponse);
  });

  it('should handle empty files array', async () => {
    const files: DownloadFileBatchRequest = [];

    const options: DownloadFileBatchOptions = {};

    // Clear mocks before this test to get accurate call count
    vi.clearAllMocks();

    const result = await _downloadFileBatch(files, options, mockConfig);

    // With batching, empty array returns early without making any API calls
    expect(fetchWithTimeout).not.toHaveBeenCalled();
    expect(result.data).toEqual([]);
    expect(result.count).toBe(0);
    expect(result.batchCount).toBe(0);
  });

  it('should include fileIds in request body', async () => {
    const mockResponse = {
      json: vi.fn().mockResolvedValue(mockDownloadFileBatchResultBase64),
    } as unknown as Response;

    vi.mocked(fetchWithTimeout).mockResolvedValue(mockResponse);
    vi.mocked(validateResponse).mockResolvedValue(undefined);

    const files: DownloadFileBatchRequest = [
      { fileId: 'file-1', branchId: 'branch-1', versionId: 'version-1' },
    ];

    const options: DownloadFileBatchOptions = {};

    await _downloadFileBatch(files, options, mockConfig);

    const requestBody = JSON.parse(
      vi.mocked(fetchWithTimeout).mock.calls[0][1].body as string
    );
    expect(requestBody).toEqual([
      { fileId: 'file-1', branchId: 'branch-1', versionId: 'version-1' },
    ]);
  });

  it('should map fileIds correctly in request body', async () => {
    const mockResponse = {
      json: vi.fn().mockResolvedValue(mockDownloadFileBatchResultBase64),
    } as unknown as Response;

    vi.mocked(fetchWithTimeout).mockResolvedValue(mockResponse);
    vi.mocked(validateResponse).mockResolvedValue(undefined);

    const files: DownloadFileBatchRequest = [
      { fileId: 'file-1', branchId: 'branch-1', versionId: 'version-1' },
      { fileId: 'file-2', branchId: 'branch-2', versionId: 'version-2' },
    ];

    const options: DownloadFileBatchOptions = {};

    await _downloadFileBatch(files, options, mockConfig);

    const requestBody = JSON.parse(
      vi.mocked(fetchWithTimeout).mock.calls[0][1].body as string
    );
    expect(requestBody).toEqual([
      { fileId: 'file-1', branchId: 'branch-1', versionId: 'version-1' },
      { fileId: 'file-2', branchId: 'branch-2', versionId: 'version-2' },
    ]);
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

    const mockFetchResponse1 = {
      json: vi.fn().mockResolvedValue(mockResponse1),
    } as unknown as Response;

    const mockFetchResponse2 = {
      json: vi.fn().mockResolvedValue(mockResponse2),
    } as unknown as Response;

    vi.mocked(fetchWithTimeout)
      .mockResolvedValueOnce(mockFetchResponse1)
      .mockResolvedValueOnce(mockFetchResponse2);
    vi.mocked(validateResponse).mockResolvedValue(undefined);

    const options: DownloadFileBatchOptions = {};

    const result = await _downloadFileBatch(files, options, mockConfig);

    // Should make 2 batch calls
    expect(fetchWithTimeout).toHaveBeenCalledTimes(2);

    // First call should have 100 files
    const firstCall = vi.mocked(fetchWithTimeout).mock.calls[0];
    const firstBody = JSON.parse(firstCall[1]?.body as string);
    expect(firstBody).toHaveLength(100);

    // Second call should have 50 files
    const secondCall = vi.mocked(fetchWithTimeout).mock.calls[1];
    const secondBody = JSON.parse(secondCall[1]?.body as string);
    expect(secondBody).toHaveLength(50);

    // Result should contain all 150 files
    expect(result.data).toHaveLength(150);
    expect(result.count).toBe(150);
    expect(result.batchCount).toBe(2);
  });
});
