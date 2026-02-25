import { describe, it, expect, vi, beforeEach } from 'vitest';
import _translateMany from '../translateMany';
import apiRequest from '../utils/apiRequest';
import { TranslationRequestConfig, TranslationResult } from '../../types';
import { Content } from '../../types-dir/jsx/content';
import { SharedMetadata } from '../../types-dir/api/entry';

vi.mock('../utils/apiRequest');

describe.sequential('_translate (via _translateMany)', () => {
  const mockConfig: TranslationRequestConfig = {
    baseUrl: 'https://api.test.com',
    projectId: 'test-project',
    apiKey: 'test-api-key',
  };

  const mockTranslationResult: TranslationResult = {
    translation: 'Hola mundo',
    dataFormat: 'ICU',
    locale: 'es',
    reference: {
      id: 'test-id',
      hash: 'test-key',
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should translate simple string content successfully', async () => {
    // _translateMany now returns Record<string, TranslationResult> from the API
    vi.mocked(apiRequest).mockResolvedValue({
      'some-hash': mockTranslationResult,
    });

    const source: Content = 'Hello world';
    const targetLocale = 'es';
    const globalMetadata: {
      targetLocale: string;
      sourceLocale: string;
    } & SharedMetadata = {
      targetLocale,
      sourceLocale: 'en',
    };

    const result = await _translateMany(
      [{ source, metadata: { context: 'greeting' } }],
      globalMetadata,
      mockConfig
    );

    expect(apiRequest).toHaveBeenCalledWith(
      expect.objectContaining({ baseUrl: 'https://api.test.com' }),
      '/v2/translate',
      expect.objectContaining({
        body: expect.objectContaining({
          targetLocale: 'es',
          sourceLocale: 'en',
        }),
        retryPolicy: 'none',
      })
    );
    expect(result).toHaveLength(1);
  });

  it('should handle complex JSX content', async () => {
    vi.mocked(apiRequest).mockResolvedValue({
      'some-hash': mockTranslationResult,
    });

    const source: Content = [
      'Welcome ',
      {
        t: 'strong',
        c: ['John'],
      },
    ];
    const targetLocale = 'es';
    const globalMetadata: {
      targetLocale: string;
      sourceLocale: string;
    } & SharedMetadata = {
      targetLocale,
      sourceLocale: 'en',
    };

    const result = await _translateMany(
      [{ source, metadata: { dataFormat: 'JSX' } }],
      globalMetadata,
      mockConfig
    );

    expect(apiRequest).toHaveBeenCalledWith(
      expect.objectContaining({ baseUrl: 'https://api.test.com' }),
      '/v2/translate',
      expect.objectContaining({
        body: expect.objectContaining({
          targetLocale: 'es',
          sourceLocale: 'en',
        }),
        retryPolicy: 'none',
      })
    );
    expect(result).toHaveLength(1);
  });

  it('should use default timeout when not specified', async () => {
    vi.mocked(apiRequest).mockResolvedValue({
      'some-hash': mockTranslationResult,
    });

    const globalMetadata: {
      targetLocale: string;
      sourceLocale: string;
    } & SharedMetadata = {
      targetLocale: 'es',
      sourceLocale: 'en',
    };

    await _translateMany([{ source: 'Hello' }], globalMetadata, mockConfig);

    expect(apiRequest).toHaveBeenCalledWith(
      expect.any(Object),
      expect.any(String),
      expect.objectContaining({ timeout: undefined })
    );
  });

  it('should respect custom timeout', async () => {
    vi.mocked(apiRequest).mockResolvedValue({
      'some-hash': mockTranslationResult,
    });

    const globalMetadata: {
      targetLocale: string;
      sourceLocale: string;
    } & SharedMetadata = {
      targetLocale: 'es',
      sourceLocale: 'en',
    };

    await _translateMany(
      [{ source: 'Hello' }],
      globalMetadata,
      mockConfig,
      5000
    );

    expect(apiRequest).toHaveBeenCalledWith(
      expect.any(Object),
      expect.any(String),
      expect.objectContaining({ timeout: 5000 })
    );
  });

  it('should include sourceLocale in request when provided', async () => {
    vi.mocked(apiRequest).mockResolvedValue({
      'some-hash': mockTranslationResult,
    });

    const globalMetadata: {
      targetLocale: string;
      sourceLocale: string;
    } & SharedMetadata = {
      targetLocale: 'es',
      sourceLocale: 'en',
    };

    await _translateMany([{ source: 'Hello' }], globalMetadata, mockConfig);

    expect(apiRequest).toHaveBeenCalledWith(
      expect.any(Object),
      expect.any(String),
      expect.objectContaining({
        body: expect.objectContaining({
          sourceLocale: 'en',
        }),
      })
    );
  });

  it('should use default URL when baseUrl not provided in config', async () => {
    vi.mocked(apiRequest).mockResolvedValue({
      'some-hash': mockTranslationResult,
    });

    const configWithoutUrl: TranslationRequestConfig = {
      projectId: 'test-project',
      apiKey: 'test-api-key',
    };

    const globalMetadata: {
      targetLocale: string;
      sourceLocale: string;
    } & SharedMetadata = {
      targetLocale: 'es',
      sourceLocale: 'en',
    };

    await _translateMany(
      [{ source: 'Hello' }],
      globalMetadata,
      configWithoutUrl
    );

    expect(apiRequest).toHaveBeenCalledWith(
      expect.objectContaining({ baseUrl: 'https://runtime2.gtx.dev' }),
      '/v2/translate',
      expect.any(Object)
    );
  });

  it('should handle fetch errors', async () => {
    const fetchError = new Error('Network error');
    vi.mocked(apiRequest).mockRejectedValue(fetchError);

    const globalMetadata: {
      targetLocale: string;
      sourceLocale: string;
    } & SharedMetadata = {
      targetLocale: 'es',
      sourceLocale: 'en',
    };

    await expect(
      _translateMany([{ source: 'Hello' }], globalMetadata, mockConfig)
    ).rejects.toThrow('Network error');
  });

  it('should handle validation errors', async () => {
    vi.mocked(apiRequest).mockRejectedValue(new Error('Validation failed'));

    const globalMetadata: {
      targetLocale: string;
      sourceLocale: string;
    } & SharedMetadata = {
      targetLocale: 'es',
      sourceLocale: 'en',
    };

    await expect(
      _translateMany([{ source: 'Hello' }], globalMetadata, mockConfig)
    ).rejects.toThrow('Validation failed');
  });

  it('should handle empty metadata', async () => {
    vi.mocked(apiRequest).mockResolvedValue({
      'some-hash': mockTranslationResult,
    });

    const globalMetadata: {
      targetLocale: string;
      sourceLocale: string;
    } & SharedMetadata = {
      targetLocale: 'es',
      sourceLocale: 'en',
    };

    const result = await _translateMany(
      [{ source: 'Hello' }],
      globalMetadata,
      mockConfig
    );

    expect(apiRequest).toHaveBeenCalledWith(
      expect.any(Object),
      expect.any(String),
      expect.objectContaining({
        body: expect.objectContaining({
          metadata: globalMetadata,
        }),
      })
    );
    expect(result).toHaveLength(1);
  });
});
