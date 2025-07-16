import { describe, it, expect, vi, beforeEach } from 'vitest';
import _downloadFileBatch from '../../src/translate/downloadFileBatch';
import fetchWithTimeout from '../../src/utils/fetchWithTimeout';
import validateResponse from '../../src/translate/utils/validateResponse';
import handleFetchError from '../../src/translate/utils/handleFetchError';
import generateRequestHeaders from '../../src/translate/utils/generateRequestHeaders';
import { TranslationRequestConfig } from '../../src/types';
import {
  DownloadFileBatchOptions,
  DownloadFileBatchResult,
} from '../../src/types-dir/downloadFileBatch';

vi.mock('../../src/utils/fetchWithTimeout');
vi.mock('../../src/translate/utils/validateResponse');
vi.mock('../../src/translate/utils/handleFetchError');
vi.mock('../../src/translate/utils/generateRequestHeaders');

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
        fileName: 'file1.json',
        data: 'file content 1',
        metadata: { contentType: 'application/json' },
      },
      {
        id: 'translation-2',
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
      json: vi.fn().mockResolvedValue(mockDownloadFileBatchResult),
    } as unknown as Response;

    vi.mocked(fetchWithTimeout).mockResolvedValue(mockResponse);
    vi.mocked(validateResponse).mockResolvedValue(undefined);

    const files: string[] = ['translation-1', 'translation-2'];

    const options: DownloadFileBatchOptions = {
      timeout: 5000,
    };

    const result = await _downloadFileBatch(files, options, mockConfig);

    expect(fetchWithTimeout).toHaveBeenCalledWith(
      'https://api.test.com/v1/project/translations/files/batch-download',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-gt-api-key': 'test-api-key',
          'x-gt-project-id': 'test-project',
        },
        body: JSON.stringify({
          fileIds: ['translation-1', 'translation-2'],
        }),
      },
      5000
    );
    expect(validateResponse).toHaveBeenCalledWith(mockResponse);
    expect(result).toEqual(mockDownloadFileBatchResult);
  });

  it('should handle single file in batch', async () => {
    const mockResponse = {
      json: vi.fn().mockResolvedValue(mockDownloadFileBatchResult),
    } as unknown as Response;

    vi.mocked(fetchWithTimeout).mockResolvedValue(mockResponse);
    vi.mocked(validateResponse).mockResolvedValue(undefined);

    const files: string[] = ['translation-1'];

    const options: DownloadFileBatchOptions = {};

    const result = await _downloadFileBatch(files, options, mockConfig);

    expect(fetchWithTimeout).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        body: JSON.stringify({
          fileIds: ['translation-1'],
        }),
      }),
      60000
    );
    expect(result).toEqual(mockDownloadFileBatchResult);
  });

  it('should use default timeout when not specified', async () => {
    const mockResponse = {
      json: vi.fn().mockResolvedValue(mockDownloadFileBatchResult),
    } as unknown as Response;

    vi.mocked(fetchWithTimeout).mockResolvedValue(mockResponse);
    vi.mocked(validateResponse).mockResolvedValue(undefined);

    const files: string[] = ['translation-1'];

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
      json: vi.fn().mockResolvedValue(mockDownloadFileBatchResult),
    } as unknown as Response;

    vi.mocked(fetchWithTimeout).mockResolvedValue(mockResponse);
    vi.mocked(validateResponse).mockResolvedValue(undefined);

    const files: string[] = ['translation-1'];

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
      json: vi.fn().mockResolvedValue(mockDownloadFileBatchResult),
    } as unknown as Response;

    vi.mocked(fetchWithTimeout).mockResolvedValue(mockResponse);
    vi.mocked(validateResponse).mockResolvedValue(undefined);

    const configWithoutUrl: TranslationRequestConfig = {
      projectId: 'test-project',
      apiKey: 'test-api-key',
    };

    const files: string[] = ['translation-1'];

    const options: DownloadFileBatchOptions = {};

    await _downloadFileBatch(files, options, configWithoutUrl);

    expect(fetchWithTimeout).toHaveBeenCalledWith(
      expect.stringContaining(
        'https://api2.gtx.dev/v1/project/translations/files/batch-download'
      ),
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

    const files: string[] = ['translation-1'];

    const options: DownloadFileBatchOptions = {};

    await expect(
      _downloadFileBatch(files, options, mockConfig)
    ).rejects.toThrow('Network error');
    expect(handleFetchError).toHaveBeenCalledWith(fetchError, 60000);
  });

  it('should handle validation errors', async () => {
    const mockResponse = {
      json: vi.fn().mockResolvedValue(mockDownloadFileBatchResult),
    } as unknown as Response;

    vi.mocked(fetchWithTimeout).mockResolvedValue(mockResponse);
    vi.mocked(validateResponse).mockImplementationOnce(() => {
      throw new Error('Validation failed');
    });

    const files: string[] = ['translation-1'];

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

    const files: string[] = [];

    const options: DownloadFileBatchOptions = {};

    const result = await _downloadFileBatch(files, options, mockConfig);

    expect(fetchWithTimeout).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        body: JSON.stringify({
          fileIds: [],
        }),
      }),
      expect.any(Number)
    );
    expect(result).toEqual(emptyResult);
  });

  it('should include fileIds in request body', async () => {
    const mockResponse = {
      json: vi.fn().mockResolvedValue(mockDownloadFileBatchResult),
    } as unknown as Response;

    vi.mocked(fetchWithTimeout).mockResolvedValue(mockResponse);
    vi.mocked(validateResponse).mockResolvedValue(undefined);

    const files: string[] = ['translation-1'];

    const options: DownloadFileBatchOptions = {};

    await _downloadFileBatch(files, options, mockConfig);

    const requestBody = JSON.parse(
      vi.mocked(fetchWithTimeout).mock.calls[0][1].body as string
    );
    expect(requestBody.fileIds).toEqual(['translation-1']);
  });

  it('should map fileIds correctly in request body', async () => {
    const mockResponse = {
      json: vi.fn().mockResolvedValue(mockDownloadFileBatchResult),
    } as unknown as Response;

    vi.mocked(fetchWithTimeout).mockResolvedValue(mockResponse);
    vi.mocked(validateResponse).mockResolvedValue(undefined);

    const files: string[] = ['trans-id-1', 'trans-id-2'];

    const options: DownloadFileBatchOptions = {};

    await _downloadFileBatch(files, options, mockConfig);

    const requestBody = JSON.parse(
      vi.mocked(fetchWithTimeout).mock.calls[0][1].body as string
    );
    expect(requestBody.fileIds).toEqual(['trans-id-1', 'trans-id-2']);
  });
});
