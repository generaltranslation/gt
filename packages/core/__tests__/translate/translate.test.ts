import { describe, it, expect, vi, beforeEach } from 'vitest';
import _translate from '../../src/translate/translate';
import fetchWithTimeout from '../../src/utils/fetchWithTimeout';
import validateResponse from '../../src/translate/utils/validateResponse';
import handleFetchError from '../../src/translate/utils/handleFetchError';
import generateRequestHeaders from '../../src/translate/utils/generateRequestHeaders';
import { TranslationRequestConfig, TranslationResult } from '../../src/types';
import { Content } from '../../src/types-dir/content';
import { EntryMetadata } from '../../src/types-dir/entry';

vi.mock('../../src/utils/fetchWithTimeout');
vi.mock('../../src/translate/utils/validateResponse');
vi.mock('../../src/translate/utils/handleFetchError');
vi.mock('../../src/translate/utils/generateRequestHeaders');

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
    vi.mocked(generateRequestHeaders).mockReturnValue({
      'Content-Type': 'application/json',
      'x-gt-api-key': 'test-api-key',
      'x-gt-project-id': 'test-project',
    });
  });

  it('should translate simple string content successfully', async () => {
    const mockResponse = {
      json: vi.fn().mockResolvedValue([mockTranslationResult]),
    } as unknown as Response;

    vi.mocked(fetchWithTimeout).mockResolvedValue(mockResponse);
    vi.mocked(validateResponse).mockResolvedValue(undefined);

    const source: Content = 'Hello world';
    const targetLocale = 'es';
    const metadata: EntryMetadata = { context: 'greeting' };

    const result = await _translate(source, targetLocale, metadata, mockConfig);

    expect(fetchWithTimeout).toHaveBeenCalledWith(
      'https://api.test.com/v1/translate/test-project',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-gt-api-key': 'test-api-key',
          'x-gt-project-id': 'test-project',
        },
        body: JSON.stringify({
          requests: [{ source }],
          targetLocale,
          metadata,
        }),
      },
      60000
    );
    expect(validateResponse).toHaveBeenCalledWith(mockResponse);
    expect(result).toEqual(mockTranslationResult);
  });

  it('should handle complex JSX content', async () => {
    const mockResponse = {
      json: vi.fn().mockResolvedValue([mockTranslationResult]),
    } as unknown as Response;

    vi.mocked(fetchWithTimeout).mockResolvedValue(mockResponse);
    vi.mocked(validateResponse).mockResolvedValue(undefined);

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

    expect(fetchWithTimeout).toHaveBeenCalledWith(
      'https://api.test.com/v1/translate/test-project',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-gt-api-key': 'test-api-key',
          'x-gt-project-id': 'test-project',
        },
        body: JSON.stringify({
          requests: [{ source }],
          targetLocale,
          metadata,
        }),
      },
      60000
    );
    expect(result).toEqual(mockTranslationResult);
  });

  it('should use default timeout when not specified', async () => {
    const mockResponse = {
      json: vi.fn().mockResolvedValue([mockTranslationResult]),
    } as unknown as Response;

    vi.mocked(fetchWithTimeout).mockResolvedValue(mockResponse);
    vi.mocked(validateResponse).mockResolvedValue(undefined);

    await _translate('Hello', 'es', {}, mockConfig);

    expect(fetchWithTimeout).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(Object),
      60000
    );
  });

  it('should respect custom timeout from metadata', async () => {
    const mockResponse = {
      json: vi.fn().mockResolvedValue([mockTranslationResult]),
    } as unknown as Response;

    vi.mocked(fetchWithTimeout).mockResolvedValue(mockResponse);
    vi.mocked(validateResponse).mockResolvedValue(undefined);

    const metadata: EntryMetadata = { timeout: 5000 };

    await _translate('Hello', 'es', metadata, mockConfig);

    expect(fetchWithTimeout).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(Object),
      5000
    );
  });

  it('should enforce maximum timeout limit', async () => {
    const mockResponse = {
      json: vi.fn().mockResolvedValue([mockTranslationResult]),
    } as unknown as Response;

    vi.mocked(fetchWithTimeout).mockResolvedValue(mockResponse);
    vi.mocked(validateResponse).mockResolvedValue(undefined);

    const metadata: EntryMetadata = { timeout: 99999 };

    await _translate('Hello', 'es', metadata, mockConfig);

    expect(fetchWithTimeout).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(Object),
      60000
    );
  });

  it('should include sourceLocale in metadata when provided', async () => {
    const mockResponse = {
      json: vi.fn().mockResolvedValue([mockTranslationResult]),
    } as unknown as Response;

    vi.mocked(fetchWithTimeout).mockResolvedValue(mockResponse);
    vi.mocked(validateResponse).mockResolvedValue(undefined);

    const metadata: EntryMetadata = { sourceLocale: 'en' };

    await _translate('Hello', 'es', metadata, mockConfig);

    expect(fetchWithTimeout).toHaveBeenCalledWith(
      expect.stringContaining('test-project'),
      expect.objectContaining({
        body: expect.stringContaining('"sourceLocale":"en"'),
      }),
      expect.any(Number)
    );
  });

  it('should use default URL when baseUrl not provided in config', async () => {
    const mockResponse = {
      json: vi.fn().mockResolvedValue([mockTranslationResult]),
    } as unknown as Response;

    vi.mocked(fetchWithTimeout).mockResolvedValue(mockResponse);
    vi.mocked(validateResponse).mockResolvedValue(undefined);

    const configWithoutUrl: TranslationRequestConfig = {
      projectId: 'test-project',
      apiKey: 'test-api-key',
    };

    await _translate('Hello', 'es', {}, configWithoutUrl);

    expect(fetchWithTimeout).toHaveBeenCalledWith(
      expect.stringContaining(
        'https://runtime2.gtx.dev/v1/translate/test-project'
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

    await expect(_translate('Hello', 'es', {}, mockConfig)).rejects.toThrow(
      'Network error'
    );
    expect(handleFetchError).toHaveBeenCalledWith(fetchError, 60000);
  });

  it('should handle validation errors', async () => {
    const mockResponse = {
      json: vi.fn().mockResolvedValue([mockTranslationResult]),
    } as unknown as Response;

    vi.mocked(fetchWithTimeout).mockResolvedValue(mockResponse);
    // Use mockImplementationOnce to avoid interfering with other tests
    vi.mocked(validateResponse).mockImplementationOnce(() => {
      throw new Error('Validation failed');
    });

    await expect(_translate('Hello', 'es', {}, mockConfig)).rejects.toThrow(
      'Validation failed'
    );
    expect(validateResponse).toHaveBeenCalledWith(mockResponse);
  });

  it('should handle empty metadata', async () => {
    const mockResponse = {
      json: vi.fn().mockResolvedValue([mockTranslationResult]),
    } as unknown as Response;

    vi.mocked(fetchWithTimeout).mockResolvedValue(mockResponse);
    vi.mocked(validateResponse).mockResolvedValue(undefined);

    const result = await _translate('Hello', 'es', {}, mockConfig);

    expect(fetchWithTimeout).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        body: expect.stringContaining('"metadata":'),
      }),
      expect.any(Number)
    );
    expect(result).toEqual(mockTranslationResult);
  });
});
