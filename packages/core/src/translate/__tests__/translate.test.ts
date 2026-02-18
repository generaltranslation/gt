import { describe, it, expect, vi, beforeEach } from 'vitest';
import _translate from '../translate';
import apiRequest from '../utils/apiRequest';
import { TranslationRequestConfig, TranslationResult } from '../../types';
import { Content } from '../../types-dir/jsx/content';
import { EntryMetadata } from '../../types-dir/api/entry';

vi.mock('../utils/apiRequest');

describe.sequential('_translate', () => {
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
    vi.mocked(apiRequest).mockResolvedValue([mockTranslationResult]);

    const source: Content = 'Hello world';
    const targetLocale = 'es';
    const metadata: EntryMetadata = { context: 'greeting' };

    const result = await _translate(source, targetLocale, metadata, mockConfig);

    expect(apiRequest).toHaveBeenCalledWith(
      mockConfig,
      '/v1/translate/test-project',
      {
        body: {
          requests: [{ source }],
          targetLocale,
          metadata,
        },
        timeout: undefined,
        retryPolicy: 'none',
      }
    );
    expect(result).toEqual(mockTranslationResult);
  });

  it('should handle complex JSX content', async () => {
    vi.mocked(apiRequest).mockResolvedValue([mockTranslationResult]);

    const source: Content = [
      'Welcome ',
      {
        t: 'strong',
        c: ['John'],
      },
    ];
    const targetLocale = 'es';
    const metadata: EntryMetadata = { dataFormat: 'JSX' };

    const result = await _translate(source, targetLocale, metadata, mockConfig);

    expect(apiRequest).toHaveBeenCalledWith(
      mockConfig,
      '/v1/translate/test-project',
      {
        body: {
          requests: [{ source }],
          targetLocale,
          metadata,
        },
        timeout: undefined,
        retryPolicy: 'none',
      }
    );
    expect(result).toEqual(mockTranslationResult);
  });

  it('should use default timeout when not specified', async () => {
    vi.mocked(apiRequest).mockResolvedValue([mockTranslationResult]);

    await _translate('Hello', 'es', {}, mockConfig);

    expect(apiRequest).toHaveBeenCalledWith(
      expect.any(Object),
      expect.any(String),
      expect.objectContaining({ timeout: undefined })
    );
  });

  it('should respect custom timeout from metadata', async () => {
    vi.mocked(apiRequest).mockResolvedValue([mockTranslationResult]);

    const metadata: EntryMetadata = { timeout: 5000 };

    await _translate('Hello', 'es', metadata, mockConfig);

    expect(apiRequest).toHaveBeenCalledWith(
      expect.any(Object),
      expect.any(String),
      expect.objectContaining({ timeout: 5000 })
    );
  });

  it('should enforce maximum timeout limit', async () => {
    vi.mocked(apiRequest).mockResolvedValue([mockTranslationResult]);

    const metadata: EntryMetadata = { timeout: 99999 };

    await _translate('Hello', 'es', metadata, mockConfig);

    expect(apiRequest).toHaveBeenCalledWith(
      expect.any(Object),
      expect.any(String),
      expect.objectContaining({ timeout: 99999 })
    );
  });

  it('should include sourceLocale in metadata when provided', async () => {
    vi.mocked(apiRequest).mockResolvedValue([mockTranslationResult]);

    const metadata: EntryMetadata = { sourceLocale: 'en' };

    await _translate('Hello', 'es', metadata, mockConfig);

    expect(apiRequest).toHaveBeenCalledWith(
      expect.any(Object),
      expect.any(String),
      expect.objectContaining({
        body: expect.objectContaining({
          metadata: expect.objectContaining({ sourceLocale: 'en' }),
        }),
      })
    );
  });

  it('should use default URL when baseUrl not provided in config', async () => {
    vi.mocked(apiRequest).mockResolvedValue([mockTranslationResult]);

    const configWithoutUrl: TranslationRequestConfig = {
      projectId: 'test-project',
      apiKey: 'test-api-key',
    };

    await _translate('Hello', 'es', {}, configWithoutUrl);

    expect(apiRequest).toHaveBeenCalledWith(
      expect.objectContaining({ baseUrl: 'https://runtime2.gtx.dev' }),
      '/v1/translate/test-project',
      expect.any(Object)
    );
  });

  it('should handle fetch errors', async () => {
    const fetchError = new Error('Network error');
    vi.mocked(apiRequest).mockRejectedValue(fetchError);

    await expect(_translate('Hello', 'es', {}, mockConfig)).rejects.toThrow(
      'Network error'
    );
  });

  it('should handle validation errors', async () => {
    vi.mocked(apiRequest).mockRejectedValue(new Error('Validation failed'));

    await expect(_translate('Hello', 'es', {}, mockConfig)).rejects.toThrow(
      'Validation failed'
    );
  });

  it('should handle empty metadata', async () => {
    vi.mocked(apiRequest).mockResolvedValue([mockTranslationResult]);

    const result = await _translate('Hello', 'es', {}, mockConfig);

    expect(apiRequest).toHaveBeenCalledWith(
      expect.any(Object),
      expect.any(String),
      expect.objectContaining({
        body: expect.objectContaining({ metadata: {} }),
      })
    );
    expect(result).toEqual(mockTranslationResult);
  });
});
