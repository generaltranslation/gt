import { describe, it, expect, vi, beforeEach } from 'vitest';
import _enqueueEntries from '../../src/translate/enqueueEntries';
import fetchWithTimeout from '../../src/utils/fetchWithTimeout';
import validateResponse from '../../src/translate/utils/validateResponse';
import handleFetchError from '../../src/translate/utils/handleFetchError';
import generateRequestHeaders from '../../src/translate/utils/generateRequestHeaders';
import { TranslationRequestConfig } from '../../src/types';
import {
  Updates,
  EnqueueEntriesOptions,
  EnqueueEntriesResult,
} from '../../src/types-dir/enqueue';

vi.mock('../../src/utils/fetchWithTimeout');
vi.mock('../../src/translate/utils/validateResponse');
vi.mock('../../src/translate/utils/handleFetchError');
vi.mock('../../src/translate/utils/generateRequestHeaders');

describe.sequential('_enqueueEntries', () => {
  const mockConfig: TranslationRequestConfig = {
    baseUrl: 'https://api.test.com',
    projectId: 'test-project',
    apiKey: 'test-api-key',
  };

  const mockEnqueueEntriesResult: EnqueueEntriesResult = {
    versionId: 'version-123',
    locales: ['es', 'fr'],
    message: 'Entries uploaded successfully',
    projectSettings: {
      cdnEnabled: true,
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

  it('should enqueue entries successfully', async () => {
    const mockResponse = {
      json: vi.fn().mockResolvedValue(mockEnqueueEntriesResult),
    } as unknown as Response;

    vi.mocked(fetchWithTimeout).mockResolvedValue(mockResponse);
    vi.mocked(validateResponse).mockResolvedValue(undefined);

    const updates: Updates = [
      {
        dataFormat: 'ICU',
        source: 'Hello world',
        metadata: { key: 'hello.world' },
      },
      {
        dataFormat: 'ICU',
        source: 'Goodbye world',
        metadata: { key: 'goodbye.world' },
      },
    ];

    const options: EnqueueEntriesOptions = {
      sourceLocale: 'en',
      dataFormat: 'ICU',
      targetLocales: ['es', 'fr'],
      version: 'v1.0.0',
      description: 'Test entries upload',
      requireApproval: true,
      timeout: 5000,
    };

    const result = await _enqueueEntries(updates, options, mockConfig);

    expect(fetchWithTimeout).toHaveBeenCalledWith(
      'https://api.test.com/v1/project/translations/update',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-gt-api-key': 'test-api-key',
          'x-gt-project-id': 'test-project',
        },
        body: JSON.stringify({
          updates,
          locales: ['es', 'fr'],
          metadata: {
            projectId: 'test-project',
            sourceLocale: 'en',
          },
          dataFormat: 'ICU',
          versionId: 'v1.0.0',
          description: 'Test entries upload',
          requireApproval: true,
        }),
      },
      5000
    );
    expect(validateResponse).toHaveBeenCalledWith(mockResponse);
    expect(result).toEqual(mockEnqueueEntriesResult);
  });

  it('should handle minimal options', async () => {
    const mockResponse = {
      json: vi.fn().mockResolvedValue(mockEnqueueEntriesResult),
    } as unknown as Response;

    vi.mocked(fetchWithTimeout).mockResolvedValue(mockResponse);
    vi.mocked(validateResponse).mockResolvedValue(undefined);

    const updates: Updates = [
      {
        dataFormat: 'ICU',
        source: 'Hello world',
        metadata: { key: 'hello.world' },
      },
    ];

    const options: EnqueueEntriesOptions = {
      sourceLocale: 'en',
    };

    const result = await _enqueueEntries(updates, options, mockConfig);

    expect(fetchWithTimeout).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        body: JSON.stringify({
          updates,
          metadata: {
            projectId: 'test-project',
            sourceLocale: 'en',
          },
        }),
      }),
      60000
    );
    expect(result).toEqual(mockEnqueueEntriesResult);
  });

  it('should use default timeout when not specified', async () => {
    const mockResponse = {
      json: vi.fn().mockResolvedValue(mockEnqueueEntriesResult),
    } as unknown as Response;

    vi.mocked(fetchWithTimeout).mockResolvedValue(mockResponse);
    vi.mocked(validateResponse).mockResolvedValue(undefined);

    const updates: Updates = [
      {
        dataFormat: 'ICU',
        source: 'Hello world',
        metadata: { key: 'hello.world' },
      },
    ];

    const options: EnqueueEntriesOptions = {
      sourceLocale: 'en',
    };

    await _enqueueEntries(updates, options, mockConfig);

    expect(fetchWithTimeout).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(Object),
      60000
    );
  });

  it('should enforce maximum timeout limit', async () => {
    const mockResponse = {
      json: vi.fn().mockResolvedValue(mockEnqueueEntriesResult),
    } as unknown as Response;

    vi.mocked(fetchWithTimeout).mockResolvedValue(mockResponse);
    vi.mocked(validateResponse).mockResolvedValue(undefined);

    const updates: Updates = [
      {
        dataFormat: 'ICU',
        source: 'Hello world',
        metadata: { key: 'hello.world' },
      },
    ];

    const options: EnqueueEntriesOptions = {
      sourceLocale: 'en',
      timeout: 99999,
    };

    await _enqueueEntries(updates, options, mockConfig);

    expect(fetchWithTimeout).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(Object),
      60000
    );
  });

  it('should use default URL when baseUrl not provided in config', async () => {
    const mockResponse = {
      json: vi.fn().mockResolvedValue(mockEnqueueEntriesResult),
    } as unknown as Response;

    vi.mocked(fetchWithTimeout).mockResolvedValue(mockResponse);
    vi.mocked(validateResponse).mockResolvedValue(undefined);

    const configWithoutUrl: TranslationRequestConfig = {
      projectId: 'test-project',
      apiKey: 'test-api-key',
    };

    const updates: Updates = [
      {
        dataFormat: 'ICU',
        source: 'Hello world',
        metadata: { key: 'hello.world' },
      },
    ];

    const options: EnqueueEntriesOptions = {
      sourceLocale: 'en',
    };

    await _enqueueEntries(updates, options, configWithoutUrl);

    expect(fetchWithTimeout).toHaveBeenCalledWith(
      expect.stringContaining(
        'https://api2.gtx.dev/v1/project/translations/update'
      ),
      expect.any(Object),
      expect.any(Number)
    );
  });

  it('should handle all optional fields', async () => {
    const mockResponse = {
      json: vi.fn().mockResolvedValue(mockEnqueueEntriesResult),
    } as unknown as Response;

    vi.mocked(fetchWithTimeout).mockResolvedValue(mockResponse);
    vi.mocked(validateResponse).mockResolvedValue(undefined);

    const updates: Updates = [
      {
        dataFormat: 'JSX',
        source: ['Hello ', { t: 'strong', c: ['world'] }],
        metadata: { key: 'hello.world' },
      },
    ];

    const options: EnqueueEntriesOptions = {
      sourceLocale: 'en',
      dataFormat: 'JSX',
      targetLocales: ['es', 'fr', 'de'],
      version: 'v2.0.0',
      description: 'Full options test',
      requireApproval: false,
    };

    await _enqueueEntries(updates, options, mockConfig);

    expect(fetchWithTimeout).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        body: expect.stringContaining('"dataFormat":"JSX"'),
      }),
      expect.any(Number)
    );

    expect(fetchWithTimeout).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        body: expect.stringContaining('"locales":["es","fr","de"]'),
      }),
      expect.any(Number)
    );

    expect(fetchWithTimeout).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        body: expect.stringContaining('"versionId":"v2.0.0"'),
      }),
      expect.any(Number)
    );

    expect(fetchWithTimeout).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        body: expect.stringContaining('"requireApproval":false'),
      }),
      expect.any(Number)
    );
  });

  it('should handle fetch errors through handleFetchError', async () => {
    const fetchError = new Error('Network error');
    vi.mocked(fetchWithTimeout).mockRejectedValue(fetchError);
    vi.mocked(handleFetchError).mockImplementation(() => {
      throw fetchError;
    });

    const updates: Updates = [
      {
        dataFormat: 'ICU',
        source: 'Hello world',
        metadata: { key: 'hello.world' },
      },
    ];

    const options: EnqueueEntriesOptions = {
      sourceLocale: 'en',
    };

    await expect(_enqueueEntries(updates, options, mockConfig)).rejects.toThrow(
      'Network error'
    );
    expect(handleFetchError).toHaveBeenCalledWith(fetchError, 60000);
  });

  it('should handle validation errors', async () => {
    const mockResponse = {
      json: vi.fn().mockResolvedValue(mockEnqueueEntriesResult),
    } as unknown as Response;

    vi.mocked(fetchWithTimeout).mockResolvedValue(mockResponse);
    vi.mocked(validateResponse).mockImplementationOnce(() => {
      throw new Error('Validation failed');
    });

    const updates: Updates = [
      {
        dataFormat: 'ICU',
        source: 'Hello world',
        metadata: { key: 'hello.world' },
      },
    ];

    const options: EnqueueEntriesOptions = {
      sourceLocale: 'en',
    };

    await expect(_enqueueEntries(updates, options, mockConfig)).rejects.toThrow(
      'Validation failed'
    );
    expect(validateResponse).toHaveBeenCalledWith(mockResponse);
  });

  it('should handle empty updates object', async () => {
    const mockResponse = {
      json: vi.fn().mockResolvedValue(mockEnqueueEntriesResult),
    } as unknown as Response;

    vi.mocked(fetchWithTimeout).mockResolvedValue(mockResponse);
    vi.mocked(validateResponse).mockResolvedValue(undefined);

    const updates: Updates = [];

    const options: EnqueueEntriesOptions = {
      sourceLocale: 'en',
    };

    const result = await _enqueueEntries(updates, options, mockConfig);

    expect(fetchWithTimeout).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        body: expect.stringContaining('"updates":[]'),
      }),
      expect.any(Number)
    );
    expect(result).toEqual(mockEnqueueEntriesResult);
  });

  it('should handle I18NEXT dataFormat', async () => {
    const mockResponse = {
      json: vi.fn().mockResolvedValue(mockEnqueueEntriesResult),
    } as unknown as Response;

    vi.mocked(fetchWithTimeout).mockResolvedValue(mockResponse);
    vi.mocked(validateResponse).mockResolvedValue(undefined);

    const updates: Updates = [
      {
        dataFormat: 'I18NEXT',
        source: 'Hello {{name}}',
        metadata: { key: 'hello.user', namespace: 'common' },
      },
    ];

    const options: EnqueueEntriesOptions = {
      sourceLocale: 'en',
      dataFormat: 'I18NEXT',
      targetLocales: ['es'],
    };

    const result = await _enqueueEntries(updates, options, mockConfig);

    expect(fetchWithTimeout).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        body: expect.stringContaining('"dataFormat":"I18NEXT"'),
      }),
      expect.any(Number)
    );
    expect(result).toEqual(mockEnqueueEntriesResult);
  });

  it('should not include requireApproval when undefined', async () => {
    const mockResponse = {
      json: vi.fn().mockResolvedValue(mockEnqueueEntriesResult),
    } as unknown as Response;

    vi.mocked(fetchWithTimeout).mockResolvedValue(mockResponse);
    vi.mocked(validateResponse).mockResolvedValue(undefined);

    const updates: Updates = [
      {
        dataFormat: 'ICU',
        source: 'Hello world',
        metadata: { key: 'hello.world' },
      },
    ];

    const options: EnqueueEntriesOptions = {
      sourceLocale: 'en',
      requireApproval: undefined,
    };

    await _enqueueEntries(updates, options, mockConfig);

    const body = JSON.parse(
      vi.mocked(fetchWithTimeout).mock.calls[0][1].body as string
    );
    expect(body).not.toHaveProperty('requireApproval');
  });
});
