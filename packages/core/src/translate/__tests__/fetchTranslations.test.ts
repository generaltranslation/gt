import { describe, it, expect, vi, beforeEach } from 'vitest';
import _fetchTranslations from '../fetchTranslations';
import fetchWithTimeout from '../utils/fetchWithTimeout';
import validateResponse from '../utils/validateResponse';
import handleFetchError from '../utils/handleFetchError';
import generateRequestHeaders from '../utils/generateRequestHeaders';
import { TranslationRequestConfig } from '../../types';
import {
  FetchTranslationsOptions,
  FetchTranslationsResult,
} from '../../types-dir/fetchTranslations';

vi.mock('../utils/fetchWithTimeout');
vi.mock('../utils/validateResponse');
vi.mock('../utils/handleFetchError');
vi.mock('../utils/generateRequestHeaders');

describe.sequential('_fetchTranslations', () => {
  const mockConfig: TranslationRequestConfig = {
    baseUrl: 'https://api.test.com',
    projectId: 'test-project',
    apiKey: 'test-api-key',
  };

  const mockFetchTranslationsResult: FetchTranslationsResult = {
    translations: [
      {
        locale: 'es',
        translation: 'Hello world',
      },
      {
        locale: 'fr',
        translation: 'Bonjour le monde',
      },
    ],
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
      expect.stringContaining(
        'https://api2.gtx.dev/v1/project/translations/info/test-version-id'
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

    const versionId = 'test-version-id';
    const options: FetchTranslationsOptions = {};

    await expect(
      _fetchTranslations(versionId, options, mockConfig)
    ).rejects.toThrow('Network error');
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

    await expect(
      _fetchTranslations(versionId, options, mockConfig)
    ).rejects.toThrow('Validation failed');
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

    await expect(
      _fetchTranslations(versionId, options, mockConfig)
    ).rejects.toThrow('Invalid JSON');
  });
});
