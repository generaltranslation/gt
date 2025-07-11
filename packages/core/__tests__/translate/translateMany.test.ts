import { describe, it, expect, vi, beforeEach } from 'vitest';
import _translateMany from '../../src/translate/translateMany';
import fetchWithTimeout from '../../src/utils/fetchWithTimeout';
import validateResponse from '../../src/translate/utils/validateResponse';
import handleFetchError from '../../src/translate/utils/handleFetchError';
import generateRequestHeaders from '../../src/translate/utils/generateRequestHeaders';
import { TranslationRequestConfig, TranslateManyResult } from '../../src/types';
import { Entry, EntryMetadata } from '../../src/types-dir/entry';

vi.mock('../../src/utils/fetchWithTimeout');
vi.mock('../../src/translate/utils/validateResponse');
vi.mock('../../src/translate/utils/handleFetchError');
vi.mock('../../src/translate/utils/generateRequestHeaders');

describe.sequential('_translateMany', () => {
  const mockConfig: TranslationRequestConfig = {
    baseUrl: 'https://api.test.com',
    projectId: 'test-project',
    apiKey: 'test-api-key',
  };

  const mockTranslateManyResult: TranslateManyResult = {
    translations: [
      {
        translation: 'Hola mundo',
        reference: {
          id: 'test-id-1',
          key: 'test-key-1',
        },
      },
      {
        translation: 'Adiós mundo',
        reference: {
          id: 'test-id-2',
          key: 'test-key-2',
        },
      },
    ],
    reference: [
      {
        id: 'test-id-1',
        key: 'test-key-1',
      },
      {
        id: 'test-id-2',
        key: 'test-key-2',
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

  it('should translate multiple entries successfully', async () => {
    const mockResponse = {
      json: vi.fn().mockResolvedValue(mockTranslateManyResult),
    } as unknown as Response;

    vi.mocked(fetchWithTimeout).mockResolvedValue(mockResponse);
    vi.mocked(validateResponse).mockResolvedValue(undefined);

    const requests: Entry[] = [
      { source: 'Hello world', targetLocale: 'es', requestMetadata: {} },
      { source: 'Goodbye world', targetLocale: 'es', requestMetadata: {} },
    ];
    const globalMetadata: { targetLocale: string } & EntryMetadata = {
      targetLocale: 'es',
      sourceLocale: 'en',
    };

    const result = await _translateMany(requests, globalMetadata, mockConfig);

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
          requests,
          targetLocale: 'es',
          metadata: globalMetadata,
        }),
      },
      60000
    );
    expect(validateResponse).toHaveBeenCalledWith(mockResponse);
    expect(result).toEqual(mockTranslateManyResult);
  });

  it('should handle complex JSX entries', async () => {
    const mockResponse = {
      json: vi.fn().mockResolvedValue(mockTranslateManyResult),
    } as unknown as Response;

    vi.mocked(fetchWithTimeout).mockResolvedValue(mockResponse);
    vi.mocked(validateResponse).mockResolvedValue(undefined);

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
          requests,
          targetLocale: 'es',
          metadata: globalMetadata,
        }),
      },
      60000
    );
    expect(result).toEqual(mockTranslateManyResult);
  });

  it('should use default timeout when not specified', async () => {
    const mockResponse = {
      json: vi.fn().mockResolvedValue(mockTranslateManyResult),
    } as unknown as Response;

    vi.mocked(fetchWithTimeout).mockResolvedValue(mockResponse);
    vi.mocked(validateResponse).mockResolvedValue(undefined);

    const requests: Entry[] = [{ source: 'Hello' }];
    const globalMetadata: { targetLocale: string } & EntryMetadata = {
      targetLocale: 'es',
    };

    await _translateMany(requests, globalMetadata, mockConfig);

    expect(fetchWithTimeout).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(Object),
      60000
    );
  });

  it('should respect custom timeout from global metadata', async () => {
    const mockResponse = {
      json: vi.fn().mockResolvedValue(mockTranslateManyResult),
    } as unknown as Response;

    vi.mocked(fetchWithTimeout).mockResolvedValue(mockResponse);
    vi.mocked(validateResponse).mockResolvedValue(undefined);

    const requests: Entry[] = [{ source: 'Hello' }];
    const globalMetadata: { targetLocale: string } & EntryMetadata = {
      targetLocale: 'es',
      timeout: 5000,
    };

    await _translateMany(requests, globalMetadata, mockConfig);

    expect(fetchWithTimeout).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(Object),
      5000
    );
  });

  it('should enforce maximum timeout limit', async () => {
    const mockResponse = {
      json: vi.fn().mockResolvedValue(mockTranslateManyResult),
    } as unknown as Response;

    vi.mocked(fetchWithTimeout).mockResolvedValue(mockResponse);
    vi.mocked(validateResponse).mockResolvedValue(undefined);

    const requests: Entry[] = [{ source: 'Hello' }];
    const globalMetadata: { targetLocale: string } & EntryMetadata = {
      targetLocale: 'es',
      timeout: 99999,
    };

    await _translateMany(requests, globalMetadata, mockConfig);

    expect(fetchWithTimeout).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(Object),
      60000
    );
  });

  it('should use default URL when baseUrl not provided in config', async () => {
    const mockResponse = {
      json: vi.fn().mockResolvedValue(mockTranslateManyResult),
    } as unknown as Response;

    vi.mocked(fetchWithTimeout).mockResolvedValue(mockResponse);
    vi.mocked(validateResponse).mockResolvedValue(undefined);

    const configWithoutUrl: TranslationRequestConfig = {
      projectId: 'test-project',
      apiKey: 'test-api-key',
    };

    const requests: Entry[] = [{ source: 'Hello' }];
    const globalMetadata: { targetLocale: string } & EntryMetadata = {
      targetLocale: 'es',
    };

    await _translateMany(requests, globalMetadata, configWithoutUrl);

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

    const requests: Entry[] = [{ source: 'Hello' }];
    const globalMetadata: { targetLocale: string } & EntryMetadata = {
      targetLocale: 'es',
    };

    await expect(
      _translateMany(requests, globalMetadata, mockConfig)
    ).rejects.toThrow('Network error');
    expect(handleFetchError).toHaveBeenCalledWith(fetchError, 60000);
  });

  it('should handle validation errors', async () => {
    const mockResponse = {
      json: vi.fn().mockResolvedValue(mockTranslateManyResult),
    } as unknown as Response;

    vi.mocked(fetchWithTimeout).mockResolvedValue(mockResponse);
    vi.mocked(validateResponse).mockImplementationOnce(() => {
      throw new Error('Validation failed');
    });

    const requests: Entry[] = [{ source: 'Hello' }];
    const globalMetadata: { targetLocale: string } & EntryMetadata = {
      targetLocale: 'es',
    };

    await expect(
      _translateMany(requests, globalMetadata, mockConfig)
    ).rejects.toThrow('Validation failed');
    expect(validateResponse).toHaveBeenCalledWith(mockResponse);
  });

  it('should handle empty requests array', async () => {
    const mockResponse = {
      json: vi.fn().mockResolvedValue({ translations: [], reference: [] }),
    } as unknown as Response;

    vi.mocked(fetchWithTimeout).mockResolvedValue(mockResponse);
    vi.mocked(validateResponse).mockResolvedValue(undefined);

    const requests: Entry[] = [];
    const globalMetadata: { targetLocale: string } & EntryMetadata = {
      targetLocale: 'es',
    };

    const result = await _translateMany(requests, globalMetadata, mockConfig);

    expect(fetchWithTimeout).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        body: expect.stringContaining('"requests":[]'),
      }),
      expect.any(Number)
    );
    expect(result).toEqual({ translations: [], reference: [] });
  });

  it('should include all global metadata in request', async () => {
    const mockResponse = {
      json: vi.fn().mockResolvedValue(mockTranslateManyResult),
    } as unknown as Response;

    vi.mocked(fetchWithTimeout).mockResolvedValue(mockResponse);
    vi.mocked(validateResponse).mockResolvedValue(undefined);

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

    expect(fetchWithTimeout).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        body: expect.stringContaining(
          '"metadata":{"targetLocale":"es","sourceLocale":"en","context":"greeting","dataFormat":"ICU","actionType":"fast","timeout":5000}'
        ),
      }),
      5000
    );
  });
});
