import {
  createApiClient,
  translate,
  type TranslateResponse,
} from '@generaltranslation/api';
import type { Content } from '@generaltranslation/format/types';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { defaultRuntimeApiUrl } from '../../settings/settingsUrls';
import { TranslationRequestConfig } from '../../types';
import { SharedMetadata, TranslateManyEntry } from '../../types-dir/api/entry';
import { hashSource } from '../../id/hashSource';
import { _translateMany } from '../translateMany';
import { fetchWithTimeout } from '../utils/fetchWithTimeout';
import { validateResponse } from '../utils/validateResponse';

vi.mock('@generaltranslation/api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@generaltranslation/api')>()),
  createApiClient: vi.fn(),
  translate: vi.fn(),
}));
vi.mock('../utils/fetchWithTimeout');
vi.mock('../utils/validateResponse');

const mockConfig: TranslationRequestConfig = {
  baseUrl: 'https://api.test.com',
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

function createResponse(overrides: Partial<Response> = {}): Response {
  return {
    ok: true,
    status: 200,
    statusText: 'OK',
    headers: new Headers(),
    json: vi.fn(),
    text: vi.fn(),
    ...overrides,
  } as unknown as Response;
}

function mockTranslateResponse(data: TranslateResponse): void {
  vi.mocked(translate).mockResolvedValue({
    data,
    request: {} as Request,
    response: createResponse(),
  });
}

describe.sequential('_translateMany', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(createApiClient).mockReturnValue(
      {} as ReturnType<typeof createApiClient>
    );
    mockTranslateResponse({});
    vi.mocked(validateResponse).mockResolvedValue(undefined);
  });

  it('routes runtime translation through the SDK at the call site', async () => {
    mockTranslateResponse({
      hash: {
        success: true,
        translation: 'Hola mundo',
        locale: 'es',
        dataFormat: 'ICU',
      },
    });

    const result = await _translateMany(
      {
        hash: {
          source: 'Hello world',
          metadata: { actionType: 'standard' },
        },
      },
      globalMetadata,
      mockConfig
    );

    expect(createApiClient).toHaveBeenCalledWith({
      apiKey: 'test-api-key',
      baseUrl: 'https://api.test.com',
      fetch: expect.any(Function),
      projectId: 'test-project',
      retryPolicy: 'none',
      timeoutMs: false,
    });
    expect(translate).toHaveBeenCalledWith({
      body: {
        requests: {
          hash: {
            source: 'Hello world',
            metadata: { actionType: 'standard' },
          },
        },
        targetLocale: 'es',
        sourceLocale: 'en',
        metadata: globalMetadata,
      },
      client: expect.any(Object),
    });
    expect(result).toEqual({
      hash: {
        success: true,
        translation: 'Hola mundo',
        locale: 'es',
        dataFormat: 'ICU',
      },
    });
  });

  it('narrows JSON translations to their format-specific content type', async () => {
    mockTranslateResponse({
      jsx: {
        success: true,
        translation: ['Hola ', { t: 'strong', c: ['mundo'] }],
        locale: 'es',
        dataFormat: 'JSX',
      },
      invalid: {
        success: true,
        translation: 42,
        locale: 'es',
        dataFormat: 'STRING',
      },
    });

    const result = await _translateMany(
      {
        jsx: { source: ['Hello ', { t: 'strong', c: ['world'] }] },
        invalid: { source: 'Forty-two' },
      },
      globalMetadata,
      mockConfig
    );

    expect(result).toEqual({
      jsx: {
        success: true,
        translation: ['Hola ', { t: 'strong', c: ['mundo'] }],
        locale: 'es',
        dataFormat: 'JSX',
      },
      invalid: {
        success: false,
        error: 'Invalid translation returned',
        code: 500,
      },
    });
  });

  it('forwards long timeouts without the SDK applying its own cap', async () => {
    await _translateMany([], globalMetadata, {
      ...mockConfig,
      timeoutMs: 99_999,
    });

    const clientConfig = vi.mocked(createApiClient).mock.calls[0][0];
    const fetchImplementation = clientConfig.fetch;
    await fetchImplementation?.('https://api.test.com/v2/translate', {
      method: 'POST',
    });

    expect(clientConfig.timeoutMs).toBe(false);
    expect(clientConfig.retryPolicy).toBe('none');
    expect(fetchWithTimeout).toHaveBeenCalledWith(
      'https://api.test.com/v2/translate',
      { method: 'POST' },
      99_999,
      undefined
    );
  });

  it.each([
    ['omitted', undefined],
    ['zero', 0],
    ['false', false],
  ] as const)(
    'passes an %s timeoutMs and the custom fetch through to fetchWithTimeout',
    async (_label, timeoutMs) => {
      const customFetch = vi.fn<typeof fetch>();

      await _translateMany([], globalMetadata, {
        ...mockConfig,
        fetch: customFetch,
        timeoutMs,
      });

      const clientConfig = vi.mocked(createApiClient).mock.calls[0][0];
      await clientConfig.fetch?.('https://api.test.com/v2/translate', {
        method: 'POST',
      });

      expect(fetchWithTimeout).toHaveBeenCalledWith(
        'https://api.test.com/v2/translate',
        { method: 'POST' },
        timeoutMs,
        customFetch
      );
    }
  );

  it('forwards an explicit API version to the API client', async () => {
    await _translateMany([], globalMetadata, {
      ...mockConfig,
      apiVersion: '2026-03-06.v1',
    });

    expect(createApiClient).toHaveBeenCalledWith(
      expect.objectContaining({ apiVersion: '2026-03-06.v1' })
    );
  });

  it('maps structured SDK errors to ApiError', async () => {
    vi.mocked(translate).mockResolvedValue({
      data: undefined,
      error: { error: 'invalid translation request' },
      request: {} as Request,
      response: createResponse({
        ok: false,
        status: 400,
        statusText: 'Bad Request',
      }),
    });

    await expect(
      _translateMany([], globalMetadata, mockConfig)
    ).rejects.toEqual(
      expect.objectContaining({
        name: 'ApiError',
        code: 400,
        message: 'invalid translation request',
      })
    );
    expect(validateResponse).not.toHaveBeenCalled();
  });

  it('preserves string SDK error bodies in ApiError', async () => {
    vi.mocked(translate).mockResolvedValue({
      data: undefined,
      error: 'upstream exploded',
      request: {} as Request,
      response: createResponse({
        ok: false,
        status: 502,
        statusText: 'Bad Gateway',
      }),
    });

    await expect(
      _translateMany([], globalMetadata, mockConfig)
    ).rejects.toEqual(
      expect.objectContaining({
        name: 'ApiError',
        code: 502,
        message: 'upstream exploded',
      })
    );
    expect(validateResponse).not.toHaveBeenCalled();
  });

  it('validates non-structured runtime API error responses', async () => {
    const response = createResponse({
      ok: false,
      status: 502,
      statusText: 'Bad Gateway',
    });
    const validationError = new Error('non-JSON runtime error');
    vi.mocked(translate).mockResolvedValue({
      data: undefined,
      error: new Error('request failed'),
      request: {} as Request,
      response,
    });
    vi.mocked(validateResponse).mockRejectedValue(validationError);

    await expect(
      _translateMany([], globalMetadata, mockConfig)
    ).rejects.toThrow(validationError);
    expect(validateResponse).toHaveBeenCalledWith(response);
  });

  it('sends complex JSX content through the SDK', async () => {
    const source: Content = ['Welcome ', { t: 'strong', c: ['John'] }];

    await _translateMany(
      [{ source, metadata: { dataFormat: 'JSX' } }],
      globalMetadata,
      mockConfig
    );

    expect(
      Object.values(vi.mocked(translate).mock.calls[0][0].body.requests)[0]
    ).toMatchObject({ source });
  });

  it('uses content hash keys while preserving custom id metadata', async () => {
    const requests: TranslateManyEntry[] = [
      {
        source: 'Hello',
        metadata: { id: 'custom-id', dataFormat: 'ICU' },
      },
    ];

    await _translateMany(requests, globalMetadata, mockConfig);

    const body = vi.mocked(translate).mock.calls[0][0].body;
    const key = Object.keys(body.requests)[0];
    expect(key).not.toBe('custom-id');
    expect(body.requests[key].source).toBe('Hello');
    expect(body.requests[key].metadata).toMatchObject({ id: 'custom-id' });
  });

  it('sends document requests with their file format and a format-aware key', async () => {
    const source = '# Hello\n\nA short document.';

    await _translateMany(
      [{ source, metadata: { fileFormat: 'MDX' } }],
      globalMetadata,
      mockConfig
    );

    const body = vi.mocked(translate).mock.calls[0][0].body;
    const [key] = Object.keys(body.requests);
    expect(body.requests[key]).toEqual({
      source,
      metadata: { fileFormat: 'MDX' },
    });
    expect(key).toBe(
      hashSource({ source, dataFormat: 'STRING', fileFormat: 'MDX' })
    );
    expect(key).not.toBe(hashSource({ source, dataFormat: 'STRING' }));
  });

  it('uses explicit hash keys before calculating a hash', async () => {
    await _translateMany(
      [
        {
          source: 'Hello',
          metadata: { id: 'custom-id', hash: 'precomputed-hash' },
        },
      ],
      globalMetadata,
      mockConfig
    );

    const body = vi.mocked(translate).mock.calls[0][0].body;
    expect(Object.keys(body.requests)).toEqual(['precomputed-hash']);
  });

  it('maps record responses back to array input order', async () => {
    const requests: TranslateManyEntry[] = [
      { source: 'Hello' },
      { source: 'Goodbye' },
    ];

    await _translateMany(requests, globalMetadata, mockConfig);
    const hashes = Object.keys(
      vi.mocked(translate).mock.calls[0][0].body.requests
    );
    mockTranslateResponse({
      [hashes[0]]: {
        success: true,
        translation: 'Hola',
        locale: 'es',
        dataFormat: 'ICU',
      },
      [hashes[1]]: { success: false, error: 'failed', code: 500 },
    });

    const result = await _translateMany(requests, globalMetadata, mockConfig);

    expect(result).toEqual([
      {
        success: true,
        translation: 'Hola',
        locale: 'es',
        dataFormat: 'ICU',
      },
      { success: false, error: 'failed', code: 500 },
    ]);
  });

  it('uses the runtime API URL by default', async () => {
    await _translateMany([], globalMetadata, {
      projectId: 'test-project',
      apiKey: 'test-api-key',
    });

    expect(createApiClient).toHaveBeenCalledWith(
      expect.objectContaining({ baseUrl: defaultRuntimeApiUrl })
    );
  });

  it('forwards the user token provider to the API client', async () => {
    const userTokenProvider = {
      getAccessToken: () => 'user-token',
      refreshAccessToken: async () => 'refreshed-token',
    };

    await _translateMany([], globalMetadata, {
      projectId: 'test-project',
      userTokenProvider,
    });

    expect(createApiClient).toHaveBeenCalledWith(
      expect.objectContaining({ apiKey: undefined, userTokenProvider })
    );
  });

  it('forwards supported model providers in request metadata', async () => {
    const metadata = {
      ...globalMetadata,
      modelProvider: 'OPENAI' as const,
    };

    await _translateMany([], metadata, mockConfig);

    expect(vi.mocked(translate).mock.calls[0][0].body.metadata).toEqual(
      metadata
    );
  });

  it('rejects unsupported model providers before making API requests', async () => {
    await expect(
      _translateMany(
        [],
        { ...globalMetadata, modelProvider: 'custom-provider' },
        mockConfig
      )
    ).rejects.toThrow('The configured model provider is not supported');

    expect(translate).not.toHaveBeenCalled();
  });

  it('propagates SDK network errors', async () => {
    vi.mocked(translate).mockRejectedValue(new Error('Network error'));

    await expect(
      _translateMany([], globalMetadata, mockConfig)
    ).rejects.toThrow('Network error');
  });
});
