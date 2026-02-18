import { describe, it, expect, vi, beforeEach } from 'vitest';
import _translateMany from '../translateMany';
import apiRequest from '../utils/apiRequest';
import { TranslationRequestConfig, TranslateManyResult } from '../../types';
import { Entry, EntryMetadata } from '../../types-dir/api/entry';

vi.mock('../utils/apiRequest');

describe.sequential('_translateMany', () => {
  const mockConfig: TranslationRequestConfig = {
    baseUrl: 'https://api.test.com',
    projectId: 'test-project',
    apiKey: 'test-api-key',
  };

  const mockTranslateManyResult: TranslateManyResult = [
    {
      translation: 'Hola mundo',
      reference: {
        id: 'test-id-1',
        hash: 'test-key-1',
      },
      locale: 'es',
      dataFormat: 'ICU',
    },
    {
      translation: 'Adiós mundo',
      reference: {
        id: 'test-id-2',
        hash: 'test-key-2',
      },
      locale: 'es',
      dataFormat: 'ICU',
    },
    {
      error: 'Error',
      code: 500,
      reference: {
        id: 'test-id-1',
        hash: 'test-key-1',
      },
    },
    {
      error: 'Error',
      code: 500,
      reference: {
        id: 'test-id-2',
        hash: 'test-key-2',
      },
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should translate multiple entries successfully', async () => {
    vi.mocked(apiRequest).mockResolvedValue(mockTranslateManyResult);

    const requests: Entry[] = [
      { source: 'Hello world', targetLocale: 'es', metadata: {} },
      { source: 'Goodbye world', targetLocale: 'es', metadata: {} },
    ];
    const globalMetadata: { targetLocale: string } & EntryMetadata = {
      targetLocale: 'es',
      sourceLocale: 'en',
    };

    const result = await _translateMany(requests, globalMetadata, mockConfig);

    expect(apiRequest).toHaveBeenCalledWith(
      mockConfig,
      '/v1/translate/test-project',
      {
        body: {
          requests,
          targetLocale: 'es',
          metadata: globalMetadata,
        },
        timeout: undefined,
      }
    );
    expect(result).toEqual(mockTranslateManyResult);
  });

  it('should handle complex JSX entries', async () => {
    vi.mocked(apiRequest).mockResolvedValue(mockTranslateManyResult);

    const requests: Entry[] = [
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
    const globalMetadata: { targetLocale: string } & EntryMetadata = {
      targetLocale: 'es',
      dataFormat: 'JSX',
    };

    const result = await _translateMany(requests, globalMetadata, mockConfig);

    expect(apiRequest).toHaveBeenCalledWith(
      mockConfig,
      '/v1/translate/test-project',
      {
        body: {
          requests,
          targetLocale: 'es',
          metadata: globalMetadata,
        },
        timeout: undefined,
      }
    );
    expect(result).toEqual(mockTranslateManyResult);
  });

  it('should use default timeout when not specified', async () => {
    vi.mocked(apiRequest).mockResolvedValue(mockTranslateManyResult);

    const requests: Entry[] = [{ source: 'Hello' }];
    const globalMetadata: { targetLocale: string } & EntryMetadata = {
      targetLocale: 'es',
    };

    await _translateMany(requests, globalMetadata, mockConfig);

    expect(apiRequest).toHaveBeenCalledWith(
      expect.any(Object),
      expect.any(String),
      expect.objectContaining({ timeout: undefined })
    );
  });

  it('should respect custom timeout from global metadata', async () => {
    vi.mocked(apiRequest).mockResolvedValue(mockTranslateManyResult);

    const requests: Entry[] = [{ source: 'Hello' }];
    const globalMetadata: { targetLocale: string } & EntryMetadata = {
      targetLocale: 'es',
      timeout: 5000,
    };

    await _translateMany(requests, globalMetadata, mockConfig);

    expect(apiRequest).toHaveBeenCalledWith(
      expect.any(Object),
      expect.any(String),
      expect.objectContaining({ timeout: 5000 })
    );
  });

  it('should enforce maximum timeout limit', async () => {
    vi.mocked(apiRequest).mockResolvedValue(mockTranslateManyResult);

    const requests: Entry[] = [{ source: 'Hello' }];
    const globalMetadata: { targetLocale: string } & EntryMetadata = {
      targetLocale: 'es',
      timeout: 99999,
    };

    await _translateMany(requests, globalMetadata, mockConfig);

    expect(apiRequest).toHaveBeenCalledWith(
      expect.any(Object),
      expect.any(String),
      expect.objectContaining({ timeout: 99999 })
    );
  });

  it('should use default URL when baseUrl not provided in config', async () => {
    vi.mocked(apiRequest).mockResolvedValue(mockTranslateManyResult);

    const configWithoutUrl: TranslationRequestConfig = {
      projectId: 'test-project',
      apiKey: 'test-api-key',
    };

    const requests: Entry[] = [{ source: 'Hello' }];
    const globalMetadata: { targetLocale: string } & EntryMetadata = {
      targetLocale: 'es',
    };

    await _translateMany(requests, globalMetadata, configWithoutUrl);

    expect(apiRequest).toHaveBeenCalledWith(
      expect.objectContaining({ baseUrl: 'https://runtime2.gtx.dev' }),
      '/v1/translate/test-project',
      expect.any(Object)
    );
  });

  it('should handle fetch errors', async () => {
    const fetchError = new Error('Network error');
    vi.mocked(apiRequest).mockRejectedValue(fetchError);

    const requests: Entry[] = [{ source: 'Hello' }];
    const globalMetadata: { targetLocale: string } & EntryMetadata = {
      targetLocale: 'es',
    };

    await expect(
      _translateMany(requests, globalMetadata, mockConfig)
    ).rejects.toThrow('Network error');
  });

  it('should handle validation errors', async () => {
    vi.mocked(apiRequest).mockRejectedValue(new Error('Validation failed'));

    const requests: Entry[] = [{ source: 'Hello' }];
    const globalMetadata: { targetLocale: string } & EntryMetadata = {
      targetLocale: 'es',
    };

    await expect(
      _translateMany(requests, globalMetadata, mockConfig)
    ).rejects.toThrow('Validation failed');
  });

  it('should handle empty requests array', async () => {
    vi.mocked(apiRequest).mockResolvedValue({
      translations: [],
      reference: [],
    });

    const requests: Entry[] = [];
    const globalMetadata: { targetLocale: string } & EntryMetadata = {
      targetLocale: 'es',
    };

    const result = await _translateMany(requests, globalMetadata, mockConfig);

    expect(apiRequest).toHaveBeenCalledWith(
      expect.any(Object),
      expect.any(String),
      expect.objectContaining({
        body: expect.objectContaining({ requests: [] }),
      })
    );
    expect(result).toEqual({ translations: [], reference: [] });
  });

  it('should include all global metadata in request', async () => {
    vi.mocked(apiRequest).mockResolvedValue(mockTranslateManyResult);

    const requests: Entry[] = [{ source: 'Hello' }];
    const globalMetadata: { targetLocale: string } & EntryMetadata = {
      targetLocale: 'es',
      sourceLocale: 'en',
      context: 'greeting',
      dataFormat: 'ICU',
      actionType: 'fast',
      timeout: 5000,
    };

    await _translateMany(requests, globalMetadata, mockConfig);

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
