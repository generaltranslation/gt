import { describe, it, expect, vi, beforeEach } from 'vitest';
import _translateMany from '../translateMany';
import apiRequest from '../utils/apiRequest';
import {
  TranslationRequestConfig,
  TranslationResult,
  TranslateManyResult,
} from '../../types';
import { TranslateManyEntry, SharedMetadata } from '../../types-dir/api/entry';

vi.mock('../utils/apiRequest');

describe.sequential('_translateMany', () => {
  const mockConfig: TranslationRequestConfig = {
    baseUrl: 'https://api.test.com',
    projectId: 'test-project',
    apiKey: 'test-api-key',
  };

  const mockResponseRecord: Record<string, TranslationResult> = {
    hash1: {
      translation: 'Hola mundo',
      reference: {
        id: 'test-id-1',
        hash: 'hash1',
      },
      locale: 'es',
      dataFormat: 'ICU',
    },
    hash2: {
      translation: 'Adiós mundo',
      reference: {
        id: 'test-id-2',
        hash: 'hash2',
      },
      locale: 'es',
      dataFormat: 'ICU',
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should translate multiple entries successfully', async () => {
    vi.mocked(apiRequest).mockResolvedValue(mockResponseRecord);

    const requests: TranslateManyEntry[] = [
      { source: 'Hello world', metadata: {} },
      { source: 'Goodbye world', metadata: {} },
    ];
    const globalMetadata: {
      targetLocale: string;
      sourceLocale: string;
    } & SharedMetadata = {
      targetLocale: 'es',
      sourceLocale: 'en',
    };

    const result = await _translateMany(requests, globalMetadata, mockConfig);

    expect(apiRequest).toHaveBeenCalledWith(
      expect.objectContaining({ baseUrl: 'https://api.test.com' }),
      '/v2/translate',
      expect.objectContaining({
        body: expect.objectContaining({
          targetLocale: 'es',
          sourceLocale: 'en',
          metadata: globalMetadata,
        }),
        timeout: undefined,
        retryPolicy: 'none',
      })
    );
    // Result is an array when input is an array
    expect(Array.isArray(result)).toBe(true);
  });

  it('should handle complex JSX entries', async () => {
    vi.mocked(apiRequest).mockResolvedValue(mockResponseRecord);

    const requests: TranslateManyEntry[] = [
      {
        source: [
          'Welcome ',
          {
            t: 'strong',
            c: ['John'],
          },
        ],
      },
      {
        source: 'Hello {name}',
      },
    ];
    const globalMetadata: {
      targetLocale: string;
      sourceLocale: string;
    } & SharedMetadata = {
      targetLocale: 'es',
      sourceLocale: 'en',
    };

    const result = await _translateMany(requests, globalMetadata, mockConfig);

    expect(apiRequest).toHaveBeenCalledWith(
      expect.objectContaining({ baseUrl: 'https://api.test.com' }),
      '/v2/translate',
      expect.objectContaining({
        body: expect.objectContaining({
          targetLocale: 'es',
          sourceLocale: 'en',
          metadata: globalMetadata,
        }),
        timeout: undefined,
        retryPolicy: 'none',
      })
    );
    expect(Array.isArray(result)).toBe(true);
  });

  it('should use default timeout when not specified', async () => {
    vi.mocked(apiRequest).mockResolvedValue(mockResponseRecord);

    const requests: TranslateManyEntry[] = [{ source: 'Hello' }];
    const globalMetadata: {
      targetLocale: string;
      sourceLocale: string;
    } & SharedMetadata = {
      targetLocale: 'es',
      sourceLocale: 'en',
    };

    await _translateMany(requests, globalMetadata, mockConfig);

    expect(apiRequest).toHaveBeenCalledWith(
      expect.any(Object),
      expect.any(String),
      expect.objectContaining({ timeout: undefined })
    );
  });

  it('should respect custom timeout parameter', async () => {
    vi.mocked(apiRequest).mockResolvedValue(mockResponseRecord);

    const requests: TranslateManyEntry[] = [{ source: 'Hello' }];
    const globalMetadata: {
      targetLocale: string;
      sourceLocale: string;
    } & SharedMetadata = {
      targetLocale: 'es',
      sourceLocale: 'en',
    };

    await _translateMany(requests, globalMetadata, mockConfig, 5000);

    expect(apiRequest).toHaveBeenCalledWith(
      expect.any(Object),
      expect.any(String),
      expect.objectContaining({ timeout: 5000 })
    );
  });

  it('should pass through large timeout values', async () => {
    vi.mocked(apiRequest).mockResolvedValue(mockResponseRecord);

    const requests: TranslateManyEntry[] = [{ source: 'Hello' }];
    const globalMetadata: {
      targetLocale: string;
      sourceLocale: string;
    } & SharedMetadata = {
      targetLocale: 'es',
      sourceLocale: 'en',
    };

    await _translateMany(requests, globalMetadata, mockConfig, 99999);

    expect(apiRequest).toHaveBeenCalledWith(
      expect.any(Object),
      expect.any(String),
      expect.objectContaining({ timeout: 99999 })
    );
  });

  it('should use default URL when baseUrl not provided in config', async () => {
    vi.mocked(apiRequest).mockResolvedValue(mockResponseRecord);

    const configWithoutUrl: TranslationRequestConfig = {
      projectId: 'test-project',
      apiKey: 'test-api-key',
    };

    const requests: TranslateManyEntry[] = [{ source: 'Hello' }];
    const globalMetadata: {
      targetLocale: string;
      sourceLocale: string;
    } & SharedMetadata = {
      targetLocale: 'es',
      sourceLocale: 'en',
    };

    await _translateMany(requests, globalMetadata, configWithoutUrl);

    expect(apiRequest).toHaveBeenCalledWith(
      expect.objectContaining({ baseUrl: 'https://runtime2.gtx.dev' }),
      '/v2/translate',
      expect.any(Object)
    );
  });

  it('should handle fetch errors', async () => {
    const fetchError = new Error('Network error');
    vi.mocked(apiRequest).mockRejectedValue(fetchError);

    const requests: TranslateManyEntry[] = [{ source: 'Hello' }];
    const globalMetadata: {
      targetLocale: string;
      sourceLocale: string;
    } & SharedMetadata = {
      targetLocale: 'es',
      sourceLocale: 'en',
    };

    await expect(
      _translateMany(requests, globalMetadata, mockConfig)
    ).rejects.toThrow('Network error');
  });

  it('should handle validation errors', async () => {
    vi.mocked(apiRequest).mockRejectedValue(new Error('Validation failed'));

    const requests: TranslateManyEntry[] = [{ source: 'Hello' }];
    const globalMetadata: {
      targetLocale: string;
      sourceLocale: string;
    } & SharedMetadata = {
      targetLocale: 'es',
      sourceLocale: 'en',
    };

    await expect(
      _translateMany(requests, globalMetadata, mockConfig)
    ).rejects.toThrow('Validation failed');
  });

  it('should handle empty requests array', async () => {
    vi.mocked(apiRequest).mockResolvedValue({});

    const requests: TranslateManyEntry[] = [];
    const globalMetadata: {
      targetLocale: string;
      sourceLocale: string;
    } & SharedMetadata = {
      targetLocale: 'es',
      sourceLocale: 'en',
    };

    const result = await _translateMany(requests, globalMetadata, mockConfig);

    expect(apiRequest).toHaveBeenCalledWith(
      expect.any(Object),
      '/v2/translate',
      expect.objectContaining({
        body: expect.objectContaining({ requests: {} }),
      })
    );
    expect(result).toEqual([]);
  });

  it('should include all global metadata in request', async () => {
    vi.mocked(apiRequest).mockResolvedValue(mockResponseRecord);

    const requests: TranslateManyEntry[] = [{ source: 'Hello' }];
    const globalMetadata: {
      targetLocale: string;
      sourceLocale: string;
    } & SharedMetadata = {
      targetLocale: 'es',
      sourceLocale: 'en',
      modelProvider: 'custom-provider',
    };

    await _translateMany(requests, globalMetadata, mockConfig, 5000);

    expect(apiRequest).toHaveBeenCalledWith(
      expect.any(Object),
      expect.any(String),
      expect.objectContaining({
        body: expect.objectContaining({
          metadata: globalMetadata,
        }),
        timeout: 5000,
      })
    );
  });
});
