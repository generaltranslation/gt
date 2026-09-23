import type {
  RuntimeTranslationResponse,
  TranslateData,
} from '@generaltranslation/api';
import type { Content } from '@generaltranslation/format/types';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { TranslationRequestConfig } from '../../types';
import { hashSource } from '../../id/hashSource';
import { translateMany } from '../runtimeTranslate';

const mockConfig: TranslationRequestConfig = {
  baseUrl: 'https://api.test.com',
  projectId: 'test-project',
  apiKey: 'test-api-key',
};
const options = { targetLocale: 'es', sourceLocale: 'en' };
const fetchMock = vi.fn<typeof fetch>();

function mockTranslateResponse(data: RuntimeTranslationResponse): void {
  fetchMock.mockResolvedValue(Response.json(data));
}

async function requestBody(): Promise<TranslateData['body']> {
  const [input, init] = fetchMock.mock.calls[0];
  return new Request(input, init).json();
}

describe.sequential('runtime translation requests', () => {
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
    mockTranslateResponse({});
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it('sends authenticated runtime requests and returns keyed results', async () => {
    const translated = {
      success: true,
      translation: 'Hola mundo',
      locale: 'es',
      dataFormat: 'ICU',
    } as const;
    mockTranslateResponse({ greeting: translated });
    const sources = {
      greeting: {
        source: 'Hello world',
        metadata: { actionType: 'standard' as const },
      },
    };

    const result = await translateMany(sources, options, mockConfig);

    const [input, init] = fetchMock.mock.calls[0];
    const request = new Request(input, init);
    expect(request.url).toBe('https://api.test.com/v2/translate');
    expect(request.method).toBe('POST');
    expect(request.headers.get('authorization')).toBe('Bearer test-api-key');
    expect(request.headers.get('gt-project-id')).toBe('test-project');
    expect(await request.json()).toEqual({
      requests: sources,
      targetLocale: 'es',
      sourceLocale: 'en',
      metadata: options,
    });
    expect(result).toEqual({ greeting: translated });
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

    const result = await translateMany(
      {
        jsx: { source: ['Hello ', { t: 'strong', c: ['world'] }] },
        invalid: { source: 'Forty-two' },
      },
      options,
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

  it('allows translation timeouts longer than the SDK default', async () => {
    vi.useFakeTimers();
    const aborted = vi.fn();
    fetchMock.mockImplementation(
      async (input, init) =>
        new Promise((_resolve, reject) => {
          const { signal } = new Request(input, init);
          signal.addEventListener('abort', () => {
            aborted();
            reject(signal.reason);
          });
        })
    );
    const pending = translateMany([], options, {
      ...mockConfig,
      timeoutMs: 99_999,
    });
    const rejected = expect(pending).rejects.toThrow('99999');

    await vi.advanceTimersByTimeAsync(60_001);
    expect(aborted).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(39_998);
    await rejected;
    expect(aborted).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it.each([
    {
      name: 'structured JSON',
      response: () =>
        Response.json(
          { error: 'invalid translation request' },
          { status: 400 }
        ),
      code: 400,
      message: 'invalid translation request',
    },
    {
      name: 'a JSON string',
      response: () => Response.json('upstream exploded', { status: 502 }),
      code: 502,
      message: 'upstream exploded',
    },
    {
      name: 'non-JSON text',
      response: () => new Response('non-JSON runtime error', { status: 502 }),
      code: 502,
      message: 'non-JSON runtime error',
    },
  ])(
    'preserves $name error details in ApiError',
    async ({ response, code, message }) => {
      fetchMock.mockResolvedValue(response());

      await expect(
        translateMany([], options, mockConfig)
      ).rejects.toMatchObject({
        name: 'ApiError',
        code,
        message,
      });
      expect(fetchMock).toHaveBeenCalledTimes(1);
    }
  );

  it('sends complex JSX content and entry metadata', async () => {
    const source: Content = ['Welcome ', { t: 'strong', c: ['John'] }];

    await translateMany(
      [{ source, metadata: { dataFormat: 'JSX' } }],
      options,
      mockConfig
    );

    expect(Object.values((await requestBody()).requests)[0]).toEqual({
      source,
      metadata: { dataFormat: 'JSX' },
    });
  });

  it('uses content hash keys while preserving custom id metadata', async () => {
    await translateMany(
      [{ source: 'Hello', metadata: { id: 'custom-id', dataFormat: 'ICU' } }],
      options,
      mockConfig
    );

    const body = await requestBody();
    const key = Object.keys(body.requests)[0];
    expect(key).not.toBe('custom-id');
    expect(body.requests[key].source).toBe('Hello');
    expect(body.requests[key].metadata).toMatchObject({ id: 'custom-id' });
  });

  it('sends document requests with their file format and a format-aware key', async () => {
    const source = '# Hello\n\nA short document.';

    await translateMany(
      [{ source, metadata: { fileFormat: 'MDX' } }],
      options,
      mockConfig
    );

    const body = await requestBody();
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
    await translateMany(
      [
        {
          source: 'Hello',
          metadata: { id: 'custom-id', hash: 'precomputed-hash' },
        },
      ],
      options,
      mockConfig
    );

    expect(Object.keys((await requestBody()).requests)).toEqual([
      'precomputed-hash',
    ]);
  });

  it('restores array order and reports failed or missing translations', async () => {
    const success = {
      success: true,
      translation: 'Hola',
      locale: 'es',
      dataFormat: 'ICU',
    } as const;
    const failure = { success: false, error: 'failed', code: 500 } as const;
    mockTranslateResponse({ second: failure, first: success });

    const result = await translateMany(
      [
        { source: 'Hello', metadata: { hash: 'first' } },
        { source: 'Goodbye', metadata: { hash: 'second' } },
        { source: 'Missing', metadata: { hash: 'third' } },
      ],
      options,
      mockConfig
    );

    expect(result).toEqual([
      success,
      failure,
      { success: false, error: 'No translation returned', code: 500 },
    ]);
  });

  it('uses the user token provider when no API key is configured', async () => {
    const userTokenProvider = {
      getAccessToken: async () => 'user-token',
      refreshAccessToken: async () => 'refreshed-token',
    };

    await translateMany([], options, {
      baseUrl: mockConfig.baseUrl,
      projectId: 'test-project',
      userTokenProvider,
    });

    const [input, init] = fetchMock.mock.calls[0];
    expect(new Request(input, init).headers.get('authorization')).toBe(
      'Bearer user-token'
    );
  });

  it('forwards supported model providers in request metadata', async () => {
    const metadata = { ...options, modelProvider: 'OPENAI' };

    await translateMany([], metadata, mockConfig);

    expect((await requestBody()).metadata).toEqual(metadata);
  });

  it('rejects unsupported model providers before making API requests', async () => {
    await expect(
      translateMany(
        [],
        { ...options, modelProvider: 'custom-provider' },
        mockConfig
      )
    ).rejects.toThrow('The configured model provider is not supported');

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('propagates network errors', async () => {
    const error = new Error('Network error');
    fetchMock.mockRejectedValue(error);

    await expect(translateMany([], options, mockConfig)).rejects.toBe(error);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
