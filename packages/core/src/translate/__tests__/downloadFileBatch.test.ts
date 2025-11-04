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
} from '../../types-dir/downloadFileBatch';

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
    expect(result).toEqual(mockDownloadFileBatchResult);
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
    expect(result).toEqual(mockDownloadFileBatchResult);
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
    const emptyResult: DownloadFileBatchResult = {
      files: [],
      count: 0,
    };

    const mockResponse = {
      json: vi.fn().mockResolvedValue(emptyResult),
    } as unknown as Response;

    vi.mocked(fetchWithTimeout).mockResolvedValue(mockResponse);
    vi.mocked(validateResponse).mockResolvedValue(undefined);

    const files: DownloadFileBatchRequest = [];

    const options: DownloadFileBatchOptions = {};

    const result = await _downloadFileBatch(files, options, mockConfig);

    expect(result).toEqual(emptyResult);
    expect(fetchWithTimeout).not.toHaveBeenCalled();
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
});
