import { describe, it, expect, vi, beforeEach } from 'vitest';
import _fetchTranslations from '../../src/translate/fetchTranslations';
import fetchWithTimeout from '../../src/utils/fetchWithTimeout';
import validateResponse from '../../src/translate/utils/validateResponse';
import handleFetchError from '../../src/translate/utils/handleFetchError';
import generateRequestHeaders from '../../src/translate/utils/generateRequestHeaders';
import { TranslationRequestConfig } from '../../src/types';
import {
  FetchTranslationsOptions,
  FetchTranslationsResult,
} from '../../src/types-dir/fetchTranslations';

vi.mock('../../src/utils/fetchWithTimeout');
vi.mock('../../src/translate/utils/validateResponse');
vi.mock('../../src/translate/utils/handleFetchError');
vi.mock('../../src/translate/utils/generateRequestHeaders');

describe.sequential('_fetchTranslations', () => {
  const mockConfig: TranslationRequestConfig = {
    baseUrl: 'https://api.test.com',
    projectId: 'test-project',
    apiKey: 'test-api-key',
  };

  const mockFetchTranslationsResult: FetchTranslationsResult = {
    versionId: 'version-123',
    translations: [
      {
        id: 'translation-1',
        key: 'hello_world',
        status: 'completed',
        locale: 'es',
      },
      {
        id: 'translation-2',
        key: 'goodbye_world',
        status: 'pending',
        locale: 'es',
      },
    ],
    metadata: {
      sourceLocale: 'en',
      targetLocales: ['es', 'fr'],
      createdAt: '2023-01-01T00:00:00Z',
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(generateRequestHeaders).mockReturnValue({
      'Content-Type': 'application/json',
      'x-gt-api-key': 'test-api-key',
      'x-gt-project-id': 'test-project',
    });
  });

  it('should fetch translation metadata successfully', async () => {
    const mockResponse = {
      json: vi.fn().mockResolvedValue(mockFetchTranslationsResult),
    } as unknown as Response;

    vi.mocked(fetchWithTimeout).mockResolvedValue(mockResponse);
    vi.mocked(validateResponse).mockResolvedValue(undefined);

    const versionId = 'test-version-id';
    const options: FetchTranslationsOptions = {
      timeout: 5000,
    };

    const result = await _fetchTranslations(versionId, options, mockConfig);

    expect(fetchWithTimeout).toHaveBeenCalledWith(
      'https://api.test.com/v1/project/translations/info/test-version-id',
      {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'x-gt-api-key': 'test-api-key',
          'x-gt-project-id': 'test-project',
        },
      },
      5000
    );
    expect(validateResponse).toHaveBeenCalledWith(mockResponse);
    expect(result).toEqual(mockFetchTranslationsResult);
  });

  it('should use default timeout when not specified', async () => {
    const mockResponse = {
      json: vi.fn().mockResolvedValue(mockFetchTranslationsResult),
    } as unknown as Response;

    vi.mocked(fetchWithTimeout).mockResolvedValue(mockResponse);
    vi.mocked(validateResponse).mockResolvedValue(undefined);

    const versionId = 'test-version-id';
    const options: FetchTranslationsOptions = {};

    await _fetchTranslations(versionId, options, mockConfig);

    expect(fetchWithTimeout).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(Object),
      60000
    );
  });

  it('should enforce maximum timeout limit', async () => {
    const mockResponse = {
      json: vi.fn().mockResolvedValue(mockFetchTranslationsResult),
    } as unknown as Response;

    vi.mocked(fetchWithTimeout).mockResolvedValue(mockResponse);
    vi.mocked(validateResponse).mockResolvedValue(undefined);

    const versionId = 'test-version-id';
    const options: FetchTranslationsOptions = {
      timeout: 99999,
    };

    await _fetchTranslations(versionId, options, mockConfig);

    expect(fetchWithTimeout).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(Object),
      60000
    );
  });

  it('should use default URL when baseUrl not provided in config', async () => {
    const mockResponse = {
      json: vi.fn().mockResolvedValue(mockFetchTranslationsResult),
    } as unknown as Response;

    vi.mocked(fetchWithTimeout).mockResolvedValue(mockResponse);
    vi.mocked(validateResponse).mockResolvedValue(undefined);

    const configWithoutUrl: TranslationRequestConfig = {
      projectId: 'test-project',
      apiKey: 'test-api-key',
    };

    const versionId = 'test-version-id';
    const options: FetchTranslationsOptions = {};

    await _fetchTranslations(versionId, options, configWithoutUrl);

    expect(fetchWithTimeout).toHaveBeenCalledWith(
      expect.stringContaining('https://runtime2.gtx.dev/v1/project/translations/info/test-version-id'),
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

    const versionId = 'test-version-id';
    const options: FetchTranslationsOptions = {};

    await expect(_fetchTranslations(versionId, options, mockConfig)).rejects.toThrow('Network error');
    expect(handleFetchError).toHaveBeenCalledWith(fetchError, 60000);
  });

  it('should handle validation errors', async () => {
    const mockResponse = {
      json: vi.fn().mockResolvedValue(mockFetchTranslationsResult),
    } as unknown as Response;

    vi.mocked(fetchWithTimeout).mockResolvedValue(mockResponse);
    vi.mocked(validateResponse).mockImplementationOnce(() => {
      throw new Error('Validation failed');
    });

    const versionId = 'test-version-id';
    const options: FetchTranslationsOptions = {};

    await expect(_fetchTranslations(versionId, options, mockConfig)).rejects.toThrow('Validation failed');
    expect(validateResponse).toHaveBeenCalledWith(mockResponse);
  });

  it('should construct correct URL with version ID', async () => {
    const mockResponse = {
      json: vi.fn().mockResolvedValue(mockFetchTranslationsResult),
    } as unknown as Response;

    vi.mocked(fetchWithTimeout).mockResolvedValue(mockResponse);
    vi.mocked(validateResponse).mockResolvedValue(undefined);

    const versionId = 'my-special-version-123';
    const options: FetchTranslationsOptions = {};

    await _fetchTranslations(versionId, options, mockConfig);

    expect(fetchWithTimeout).toHaveBeenCalledWith(
      'https://api.test.com/v1/project/translations/info/my-special-version-123',
      expect.any(Object),
      expect.any(Number)
    );
  });

  it('should handle empty response data', async () => {
    const emptyResult = {
      versionId: 'version-123',
      translations: [],
      metadata: {},
    };
    const mockResponse = {
      json: vi.fn().mockResolvedValue(emptyResult),
    } as unknown as Response;

    vi.mocked(fetchWithTimeout).mockResolvedValue(mockResponse);
    vi.mocked(validateResponse).mockResolvedValue(undefined);

    const versionId = 'test-version-id';
    const options: FetchTranslationsOptions = {};

    const result = await _fetchTranslations(versionId, options, mockConfig);

    expect(result).toEqual(emptyResult);
  });

  it('should handle JSON parsing errors', async () => {
    const mockResponse = {
      json: vi.fn().mockRejectedValue(new Error('Invalid JSON')),
    } as unknown as Response;

    vi.mocked(fetchWithTimeout).mockResolvedValue(mockResponse);
    vi.mocked(validateResponse).mockResolvedValue(undefined);

    const versionId = 'test-version-id';
    const options: FetchTranslationsOptions = {};

    await expect(_fetchTranslations(versionId, options, mockConfig)).rejects.toThrow('Invalid JSON');
  });
});