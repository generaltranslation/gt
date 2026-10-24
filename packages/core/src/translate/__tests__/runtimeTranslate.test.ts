import type {
  RuntimeTranslationResponse,
  TranslateContentData,
} from '@generaltranslation/api';
import type { Content } from '@generaltranslation/format/types';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { hashSource } from '../../id/hashSource';
import { GTRuntime } from '../../runtime';

const runtime = new GTRuntime({
  baseUrl: 'https://api.test.com',
  projectId: 'test-project',
  apiKey: 'test-api-key',
});
const options = { targetLocale: 'es', sourceLocale: 'en' };
const fetchMock = vi.fn<typeof fetch>();

function mockTranslateResponse(data: RuntimeTranslationResponse): void {
  fetchMock.mockResolvedValue(
    Response.json({ translations: data, generated: true })
  );
}

async function requestBody(): Promise<TranslateContentData['body']> {
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

    const result = await runtime.translateMany(sources, options);

    const [input, init] = fetchMock.mock.calls[0];
    const request = new Request(input, init);
    expect(request.url).toBe(
      'https://api.test.com/v2/projects/test-project/translate'
    );
    expect(request.method).toBe('POST');
    expect(request.headers.get('authorization')).toBe('Bearer test-api-key');
    expect(request.headers.has('gt-project-id')).toBe(false);
    expect(await request.json()).toEqual({
      requests: sources,
      targetLocale: 'es',
      sourceLocale: 'en',
      metadata: {},
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

    const result = await runtime.translateMany(
      {
        jsx: { source: ['Hello ', { t: 'strong', c: ['world'] }] },
        invalid: { source: 'Forty-two' },
      },
      options
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
        code: 'internal_error',
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
    const pending = runtime.translateMany([], options, 99_999);
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
          { error: 'invalid translation request', code: 'invalid_request' },
          { status: 400 }
        ),
      status: 400,
      code: 'invalid_request',
      message: 'invalid translation request',
    },
    {
      name: 'a JSON string',
      response: () => Response.json('upstream exploded', { status: 502 }),
      status: 502,
      code: undefined,
      message: 'upstream exploded',
    },
    {
      name: 'non-JSON text',
      response: () => new Response('non-JSON runtime error', { status: 502 }),
      status: 502,
      code: undefined,
      message: 'non-JSON runtime error',
    },
    {
      name: 'an empty body',
      response: () =>
        new Response(null, { status: 503, statusText: 'Service Unavailable' }),
      status: 503,
      code: undefined,
      message: 'Service Unavailable',
    },
    {
      name: 'an empty body without status text',
      response: () => new Response(null, { status: 503 }),
      status: 503,
      code: undefined,
      message: 'HTTP 503',
    },
  ])(
    'preserves $name error details in ApiError',
    async ({ response, status, code, message }) => {
      fetchMock.mockResolvedValue(response());

      await expect(runtime.translateMany([], options)).rejects.toMatchObject({
        name: 'ApiError',
        status,
        code,
        message,
      });
      expect(fetchMock).toHaveBeenCalledTimes(1);
    }
  );

  it('sends complex JSX content and entry metadata', async () => {
    const source: Content = ['Welcome ', { t: 'strong', c: ['John'] }];

    await runtime.translateMany(
      [{ source, metadata: { dataFormat: 'JSX' } }],
      options
    );

    expect(Object.values((await requestBody()).requests)[0]).toEqual({
      source,
      metadata: { dataFormat: 'JSX' },
    });
  });

  it('uses content hash keys while preserving custom id metadata', async () => {
    await runtime.translateMany(
      [{ source: 'Hello', metadata: { id: 'custom-id', dataFormat: 'ICU' } }],
      options
    );

    const body = await requestBody();
    const key = Object.keys(body.requests)[0];
    expect(key).not.toBe('custom-id');
    expect(body.requests[key].source).toBe('Hello');
    expect(body.requests[key].metadata).toMatchObject({ id: 'custom-id' });
  });

  it('sends document requests with their file format and a format-aware key', async () => {
    const source = '# Hello\n\nA short document.';

    await runtime.translateMany(
      [{ source, metadata: { fileFormat: 'MDX' } }],
      options
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
    await runtime.translateMany(
      [
        {
          source: 'Hello',
          metadata: { id: 'custom-id', hash: 'precomputed-hash' },
        },
      ],
      options
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
    const failure = {
      success: false,
      error: 'failed',
      code: 'upstream_error',
    } as const;
    mockTranslateResponse({ second: failure, first: success });

    const result = await runtime.translateMany(
      [
        { source: 'Hello', metadata: { hash: 'first' } },
        { source: 'Goodbye', metadata: { hash: 'second' } },
        { source: 'Missing', metadata: { hash: 'third' } },
      ],
      options
    );

    expect(result).toEqual([
      success,
      failure,
      {
        success: false,
        error: 'No translation returned',
        code: 'internal_error',
      },
    ]);
  });

  it('uses the user token provider when no API key is configured', async () => {
    const userTokenProvider = {
      getAccessToken: async () => 'user-token',
      refreshAccessToken: async () => 'refreshed-token',
    };

    await new GTRuntime({
      baseUrl: 'https://api.test.com',
      projectId: 'test-project',
      userTokenProvider,
    }).translateMany([], options);

    const [input, init] = fetchMock.mock.calls[0];
    expect(new Request(input, init).headers.get('authorization')).toBe(
      'Bearer user-token'
    );
  });

  it('sends only the model provider in request metadata', async () => {
    await runtime.translateMany([], { ...options, modelProvider: 'OPENAI' });

    expect((await requestBody()).metadata).toEqual({ modelProvider: 'OPENAI' });
  });

  it('rejects unsupported model providers before making API requests', async () => {
    await expect(
      runtime.translateMany([], {
        ...options,
        modelProvider: 'custom-provider',
      })
    ).rejects.toThrow('Unsupported model provider `custom-provider`');

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('propagates network errors', async () => {
    const error = new Error('Network error');
    fetchMock.mockRejectedValue(error);

    await expect(runtime.translateMany([], options)).rejects.toBe(error);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
