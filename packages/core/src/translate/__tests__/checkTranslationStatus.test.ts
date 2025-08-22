import { describe, it, expect, vi, beforeEach } from 'vitest';
import _checkTranslationStatus from '../checkTranslationStatus';
import fetchWithTimeout from '../utils/fetchWithTimeout';
import validateResponse from '../utils/validateResponse';
import handleFetchError from '../utils/handleFetchError';
import generateRequestHeaders from '../utils/generateRequestHeaders';
import { TranslationRequestConfig } from '../../types';
import {
  CheckTranslationStatusOptions,
  TranslationStatusResult,
} from '../../types-dir/translationStatus';

vi.mock('../utils/fetchWithTimeout');
vi.mock('../utils/validateResponse');
vi.mock('../utils/handleFetchError');
vi.mock('../utils/generateRequestHeaders');

describe.sequential('_checkTranslationStatus', () => {
  const mockConfig: TranslationRequestConfig = {
    baseUrl: 'https://api.test.com',
    projectId: 'test-project',
    apiKey: 'test-api-key',
  };

  const mockTranslationStatusResult: TranslationStatusResult = {
    count: 5,
    availableLocales: ['es', 'fr', 'de'],
    locales: ['es', 'fr'],
    localesWaitingForApproval: [],
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(generateRequestHeaders).mockReturnValue({
      'Content-Type': 'application/json',
      'x-gt-api-key': 'test-api-key',
      'x-gt-project-id': 'test-project',
    });
  });

  it('should check translation status successfully', async () => {
    const mockResponse = {
      json: vi.fn().mockResolvedValue(mockTranslationStatusResult),
    } as unknown as Response;

    vi.mocked(fetchWithTimeout).mockResolvedValue(mockResponse);
    vi.mocked(validateResponse).mockResolvedValue(undefined);

    const versionId = 'version-123';
    const options: CheckTranslationStatusOptions = {
      timeout: 5000,
    };

    const result = await _checkTranslationStatus(
      versionId,
      options,
      mockConfig
    );

    expect(fetchWithTimeout).toHaveBeenCalledWith(
      'https://api.test.com/v2/project/translations/status/version-123',
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
    expect(result).toEqual(mockTranslationStatusResult);
  });

  it('should use config baseUrl when provided', async () => {
    const mockResponse = {
      json: vi.fn().mockResolvedValue(mockTranslationStatusResult),
    } as unknown as Response;

    vi.mocked(fetchWithTimeout).mockResolvedValue(mockResponse);
    vi.mocked(validateResponse).mockResolvedValue(undefined);

    const versionId = 'version-123';
    const options: CheckTranslationStatusOptions = {};

    await _checkTranslationStatus(versionId, options, mockConfig);

    expect(fetchWithTimeout).toHaveBeenCalledWith(
      'https://api.test.com/v2/project/translations/status/version-123',
      expect.any(Object),
      expect.any(Number)
    );
  });

  it('should use default URL when baseUrl not provided in config', async () => {
    const mockResponse = {
      json: vi.fn().mockResolvedValue(mockTranslationStatusResult),
    } as unknown as Response;

    vi.mocked(fetchWithTimeout).mockResolvedValue(mockResponse);
    vi.mocked(validateResponse).mockResolvedValue(undefined);

    const configWithoutUrl: TranslationRequestConfig = {
      projectId: 'test-project',
      apiKey: 'test-api-key',
    };

    const versionId = 'version-123';
    const options: CheckTranslationStatusOptions = {};

    await _checkTranslationStatus(versionId, options, configWithoutUrl);

    expect(fetchWithTimeout).toHaveBeenCalledWith(
      expect.stringContaining(
        'https://api2.gtx.dev/v2/project/translations/status/version-123'
      ),
      expect.any(Object),
      expect.any(Number)
    );
  });

  it('should use default timeout when not specified', async () => {
    const mockResponse = {
      json: vi.fn().mockResolvedValue(mockTranslationStatusResult),
    } as unknown as Response;

    vi.mocked(fetchWithTimeout).mockResolvedValue(mockResponse);
    vi.mocked(validateResponse).mockResolvedValue(undefined);

    const versionId = 'version-123';
    const options: CheckTranslationStatusOptions = {};

    await _checkTranslationStatus(versionId, options, mockConfig);

    expect(fetchWithTimeout).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(Object),
      60000
    );
  });

  it('should enforce maximum timeout limit', async () => {
    const mockResponse = {
      json: vi.fn().mockResolvedValue(mockTranslationStatusResult),
    } as unknown as Response;

    vi.mocked(fetchWithTimeout).mockResolvedValue(mockResponse);
    vi.mocked(validateResponse).mockResolvedValue(undefined);

    const versionId = 'version-123';
    const options: CheckTranslationStatusOptions = {
      timeout: 99999,
    };

    await _checkTranslationStatus(versionId, options, mockConfig);

    expect(fetchWithTimeout).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(Object),
      60000
    );
  });

  it('should handle fetch errors through handleFetchError', async () => {
    const fetchError = new Error('Network error');
    vi.mocked(fetchWithTimeout).mockRejectedValue(fetchError);
    vi.mocked(handleFetchError).mockImplementation(() => {
      throw fetchError;
    });

    const versionId = 'version-123';
    const options: CheckTranslationStatusOptions = {};

    await expect(
      _checkTranslationStatus(versionId, options, mockConfig)
    ).rejects.toThrow('Network error');
    expect(handleFetchError).toHaveBeenCalledWith(fetchError, 60000);
  });

  it('should handle validation errors', async () => {
    const mockResponse = {
      json: vi.fn().mockResolvedValue(mockTranslationStatusResult),
    } as unknown as Response;

    vi.mocked(fetchWithTimeout).mockResolvedValue(mockResponse);
    vi.mocked(validateResponse).mockImplementationOnce(() => {
      throw new Error('Validation failed');
    });

    const versionId = 'version-123';
    const options: CheckTranslationStatusOptions = {};

    await expect(
      _checkTranslationStatus(versionId, options, mockConfig)
    ).rejects.toThrow('Validation failed');
    expect(validateResponse).toHaveBeenCalledWith(mockResponse);
  });

  it('should encode version ID in URL properly', async () => {
    const mockResponse = {
      json: vi.fn().mockResolvedValue(mockTranslationStatusResult),
    } as unknown as Response;

    vi.mocked(fetchWithTimeout).mockResolvedValue(mockResponse);
    vi.mocked(validateResponse).mockResolvedValue(undefined);

    const versionId = 'version with spaces';
    const options: CheckTranslationStatusOptions = {};

    await _checkTranslationStatus(versionId, options, mockConfig);

    expect(fetchWithTimeout).toHaveBeenCalledWith(
      'https://api.test.com/v2/project/translations/status/version%20with%20spaces',
      expect.any(Object),
      expect.any(Number)
    );
  });

  it('should handle JSON parsing errors', async () => {
    const mockResponse = {
      json: vi.fn().mockRejectedValue(new Error('Invalid JSON')),
    } as unknown as Response;

    vi.mocked(fetchWithTimeout).mockResolvedValue(mockResponse);
    vi.mocked(validateResponse).mockResolvedValue(undefined);

    const versionId = 'version-123';
    const options: CheckTranslationStatusOptions = {};

    await expect(
      _checkTranslationStatus(versionId, options, mockConfig)
    ).rejects.toThrow('Invalid JSON');
  });

  it('should handle empty locales arrays', async () => {
    const emptyResult: TranslationStatusResult = {
      count: 0,
      availableLocales: [],
      locales: [],
      localesWaitingForApproval: [],
    };

    const mockResponse = {
      json: vi.fn().mockResolvedValue(emptyResult),
    } as unknown as Response;

    vi.mocked(fetchWithTimeout).mockResolvedValue(mockResponse);
    vi.mocked(validateResponse).mockResolvedValue(undefined);

    const versionId = 'version-123';
    const options: CheckTranslationStatusOptions = {};

    const result = await _checkTranslationStatus(
      versionId,
      options,
      mockConfig
    );

    expect(result).toEqual(emptyResult);
  });

  it('should handle locales waiting for approval', async () => {
    const resultWithApproval: TranslationStatusResult = {
      count: 3,
      availableLocales: ['es', 'fr', 'de'],
      locales: ['es'],
      localesWaitingForApproval: ['fr', 'de'],
    };

    const mockResponse = {
      json: vi.fn().mockResolvedValue(resultWithApproval),
    } as unknown as Response;

    vi.mocked(fetchWithTimeout).mockResolvedValue(mockResponse);
    vi.mocked(validateResponse).mockResolvedValue(undefined);

    const versionId = 'version-123';
    const options: CheckTranslationStatusOptions = {};

    const result = await _checkTranslationStatus(
      versionId,
      options,
      mockConfig
    );

    expect(result).toEqual(resultWithApproval);
  });
});
