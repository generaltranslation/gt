import {
  API_VERSION,
  type TranslateContentData,
  type TranslateContentResponse,
} from '@generaltranslation/api';
import type { Content } from '@generaltranslation/format';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GeneralTranslation } from '../../index';
import { GTRuntime } from '../../runtime';
import { defaultRuntimeApiUrl } from '../../settings/settingsUrls';

const config = {
  baseUrl: 'https://api.test.com',
  projectId: 'test-project',
  apiKey: 'test-api-key',
};
const runtime = new GTRuntime(config);
const options = { targetLocale: 'es', sourceLocale: 'en' };
const fetchMock = vi.fn<typeof fetch>();

function mockTranslateResponse(
  results: TranslateContentResponse['results']
): void {
  const succeeded = results.filter(
    ({ status }) => status === 'succeeded'
  ).length;
  fetchMock.mockResolvedValue(
    Response.json({
      summary: {
        total: results.length,
        succeeded,
        failed: results.length - succeeded,
      },
      results,
    } satisfies TranslateContentResponse)
  );
}

// Answers every source with `<source>:<targetLocale>`.
function echoTranslations(): void {
  fetchMock.mockImplementation(async (input, init) => {
    // Read a copy, so requestBody() can still read the request.
    const request =
      input instanceof Request ? input.clone() : new Request(input, init);
    const { requests, targetLocale } =
      (await request.json()) as TranslateContentData['body'];
    return Response.json({
      results: requests.map(({ source }) => ({
        status: 'succeeded',
        translation: `${source}:${targetLocale}`,
        locale: targetLocale,
        dataFormat: 'STRING',
      })),
    });
  });
}

// Settles only when the request is aborted, by a timeout or the caller.
function hangUntilAborted(onAbort = () => {}): void {
  fetchMock.mockImplementation(
    async (input, init) =>
      new Promise((_resolve, reject) => {
        const { signal } = new Request(input, init);
        signal.addEventListener('abort', () => {
          onAbort();
          reject(signal.reason);
        });
      })
  );
}

async function requestBody(call = 0): Promise<TranslateContentData['body']> {
  const [input, init] = fetchMock.mock.calls[call];
  return new Request(input, init).json();
}

describe.sequential('runtime translation requests', () => {
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
    mockTranslateResponse([]);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it('sends authenticated runtime requests and returns keyed results', async () => {
    const translated = {
      translation: 'Hola mundo',
      locale: 'es',
      dataFormat: 'ICU',
    } as const;
    mockTranslateResponse([{ status: 'succeeded', ...translated }]);
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
    expect(request.headers.get('gt-api-version')).toBe(API_VERSION);
    expect(request.headers.has('gt-project-id')).toBe(false);
    expect(await request.json()).toEqual({
      requests: [sources.greeting],
      targetLocale: 'es',
      sourceLocale: 'en',
      metadata: {},
    });
    expect(result).toEqual({ greeting: { success: true, ...translated } });
  });

  it('translates a single entry with its metadata and options', async () => {
    const translated = {
      translation: 'Bonjour',
      locale: 'fr',
      dataFormat: 'ICU',
    } as const;
    mockTranslateResponse([{ status: 'succeeded', ...translated }]);
    const entry = {
      source: 'Hello {name}',
      metadata: { hash: 'greeting', id: 'welcome', dataFormat: 'ICU' },
    } as const;

    const result = await runtime.translate(entry, {
      targetLocale: 'fr',
      sourceLocale: 'en-US',
      modelProvider: 'OPENAI',
    });

    expect(result).toEqual({ success: true, ...translated });
    expect(await requestBody()).toEqual({
      requests: [entry],
      targetLocale: 'fr',
      sourceLocale: 'en-US',
      metadata: { modelProvider: 'OPENAI' },
    });
  });

  it('accepts a target locale string and defaults the source locale', async () => {
    echoTranslations();

    const record = await runtime.translateMany(
      { first: 'Hello', second: 'Goodbye' },
      'fr'
    );
    const single = await runtime.translate('Hello', 'fr');

    expect(record).toMatchObject({
      first: { translation: 'Hello:fr' },
      second: { translation: 'Goodbye:fr' },
    });
    expect(single).toMatchObject({ success: true, locale: 'fr' });
    expect(await requestBody(1)).toMatchObject({
      targetLocale: 'fr',
      sourceLocale: 'en',
    });
  });

  it('sends the configured source locale for single and batch translation, also from a project-scoped GeneralTranslation', async () => {
    echoTranslations();
    const params = {
      ...config,
      localeConfig: {
        defaultLocale: 'fr-fr',
        customMapping: { british: { code: 'en-gb' } },
      },
    };

    for (const client of [
      new GTRuntime(params),
      new GeneralTranslation(params),
    ]) {
      await client.translate('Hello', 'british');
      await client.translateMany(
        { greeting: 'Hello' },
        { targetLocale: 'british', sourceLocale: '' }
      );
    }

    expect(fetchMock).toHaveBeenCalledTimes(4);
    for (const call of [0, 1, 2, 3]) {
      expect(await requestBody(call)).toMatchObject({
        sourceLocale: 'fr-FR',
        targetLocale: 'en-GB',
      });
    }
  });

  it('canonicalizes an alias through customMapping without restoring it in the result', async () => {
    echoTranslations();

    const result = await new GTRuntime({
      ...config,
      localeConfig: { customMapping: { british: { code: 'en-gb' } } },
    }).translate('Hello', 'british');

    expect((await requestBody()).targetLocale).toBe('en-GB');
    expect(result).toMatchObject({ locale: 'en-GB' });
  });

  it('uses the runtime API URL when no base URL is configured', async () => {
    await new GTRuntime({
      projectId: 'test-project',
      apiKey: 'test-api-key',
    }).translateMany([], options);

    const [input, init] = fetchMock.mock.calls[0];
    expect(new URL(new Request(input, init).url).origin).toBe(
      new URL(defaultRuntimeApiUrl).origin
    );
  });

  it.each(['translate', 'translateMany'] as const)(
    'names %s when the target locale is missing, before any request',
    async (method) => {
      const result =
        method === 'translate'
          ? runtime.translate('Hello', '')
          : runtime.translateMany(['Hello'], '');

      await expect(result).rejects.toThrow(
        `GT Error: Cannot call \`${method}\` without a target locale. Pass the target locale to \`${method}()\`.`
      );
      expect(fetchMock).not.toHaveBeenCalled();
    }
  );

  it('returns successful translations as the service sent them', async () => {
    const jsx = {
      translation: ['Hola ', { t: 'strong', c: ['mundo'] }],
      locale: 'es',
      dataFormat: 'JSX' as const,
    };
    const mismatched = {
      translation: 42,
      locale: 'es',
      dataFormat: 'STRING' as const,
    };
    const tree = {
      translation: ['Hola, ', ['name']],
      locale: 'es',
      dataFormat: 'MESSAGE_TREE' as const,
    };
    mockTranslateResponse([
      { status: 'succeeded', ...jsx },
      { status: 'succeeded', ...mismatched },
      { status: 'succeeded', ...tree },
    ]);

    const result = await runtime.translateMany(
      {
        jsx: { source: ['Hello ', { t: 'strong', c: ['world'] }] },
        mismatched: { source: 'Forty-two' },
        tree: {
          source: ['Hello, ', ['name']],
          metadata: { dataFormat: 'MESSAGE_TREE' },
        },
      },
      options
    );

    expect(result).toEqual({
      jsx: { success: true, ...jsx },
      mismatched: { success: true, ...mismatched },
      tree: { success: true, ...tree },
    });
  });

  it('times out after the per-call timeout, else the 60 second default', async () => {
    vi.useFakeTimers();
    hangUntilAborted();

    const perCall = expect(
      runtime.translate('Hello', 'es', 1_000)
    ).rejects.toThrow('Request timed out after 1000ms');
    await vi.advanceTimersByTimeAsync(1_000);
    await perCall;

    const runtimeDefault = expect(
      runtime.translate('Hello', 'es')
    ).rejects.toThrow('Request timed out after 60000ms');
    await vi.advanceTimersByTimeAsync(60_000);
    await runtimeDefault;
  });

  it('treats a zero timeout as a literal zero', async () => {
    vi.useFakeTimers();
    hangUntilAborted();

    const zero = expect(
      runtime.translateMany(['Hello'], 'es', 0)
    ).rejects.toThrow('Request timed out after 0ms');
    await vi.advanceTimersByTimeAsync(0);
    await zero;
  });

  it('allows translation timeouts longer than the SDK default', async () => {
    vi.useFakeTimers();
    const aborted = vi.fn();
    hangUntilAborted(aborted);
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

    expect((await requestBody()).requests[0]).toEqual({
      source,
      metadata: { dataFormat: 'JSX' },
    });
  });

  it('sends custom id metadata without using it to match results', async () => {
    await runtime.translateMany(
      [{ source: 'Hello', metadata: { id: 'custom-id', dataFormat: 'ICU' } }],
      options
    );

    expect((await requestBody()).requests).toEqual([
      { source: 'Hello', metadata: { id: 'custom-id', dataFormat: 'ICU' } },
    ]);
  });

  it('sends a document apart from the same text without a file format', async () => {
    const source = '# Hello\n\nA short document.';

    await runtime.translateMany(
      [{ source, metadata: { fileFormat: 'MDX' } }, { source }],
      options
    );

    expect((await requestBody()).requests).toEqual([
      { source, metadata: { fileFormat: 'MDX' } },
      { source },
    ]);
  });

  it('sends entries that share a hash once and returns the result to each', async () => {
    const translated = {
      translation: 'Hola',
      locale: 'es',
      dataFormat: 'STRING',
    } as const;
    mockTranslateResponse([
      { status: 'succeeded', ...translated },
      { status: 'succeeded', ...translated, translation: 'Adiós' },
    ]);

    const result = await runtime.translateMany(
      [
        { source: 'Hello', metadata: { hash: 'precomputed-hash' } },
        'Goodbye',
        { source: 'Hello', metadata: { hash: 'precomputed-hash' } },
        'Goodbye',
      ],
      options
    );

    expect((await requestBody()).requests).toEqual([
      { source: 'Hello', metadata: { hash: 'precomputed-hash' } },
      { source: 'Goodbye' },
    ]);
    const hello = { success: true, ...translated };
    const goodbye = { ...hello, translation: 'Adiós' };
    expect(result).toEqual([hello, goodbye, hello, goodbye]);
  });

  it('matches results to entries by position and reports failed or missing translations', async () => {
    const translated = {
      translation: 'Hola',
      locale: 'es',
      dataFormat: 'ICU',
    } as const;
    const failure = { error: 'failed', code: 'upstream_error' } as const;
    mockTranslateResponse([
      { status: 'succeeded', ...translated },
      { status: 'failed', ...failure },
    ]);

    const result = await runtime.translateMany(
      ['Hello', 'Goodbye', 'Missing'],
      options
    );

    expect(result).toEqual([
      { success: true, ...translated },
      { success: false, ...failure },
      {
        success: false,
        error: 'No translation returned',
        code: 'internal_error',
      },
    ]);
  });

  it('splits requests over the 4MB body limit and merges their results', async () => {
    const bodies: { bytes: number; hashes: string[] }[] = [];
    fetchMock.mockImplementation(async (input, init) => {
      const text = await new Request(input, init).text();
      const { requests } = JSON.parse(text) as {
        requests: { metadata: { hash: string } }[];
      };
      const hashes = requests.map(({ metadata }) => metadata.hash);
      bodies.push({
        bytes: new TextEncoder().encode(text).byteLength,
        hashes,
      });
      return Response.json({
        results: hashes.map((hash) => ({
          status: 'succeeded',
          translation: `es:${hash}`,
          locale: 'es',
          dataFormat: 'STRING',
        })),
      });
    });
    const large = 'x'.repeat(1_500_000);

    const result = await runtime.translateMany(
      ['a', 'b', 'c'].map((hash) => ({ source: large, metadata: { hash } })),
      options
    );

    expect(bodies.map(({ hashes }) => hashes)).toEqual([['a', 'b'], ['c']]);
    for (const { bytes } of bodies)
      expect(bytes).toBeLessThanOrEqual(4_000_000);
    expect(result).toEqual(
      ['a', 'b', 'c'].map((hash) => ({
        success: true,
        translation: `es:${hash}`,
        locale: 'es',
        dataFormat: 'STRING',
      }))
    );
  });

  it('uses the user token provider when no API key is configured, asking for the token only when it sends a request', async () => {
    const userTokenProvider = {
      getAccessToken: vi.fn(async () => 'user-token'),
      refreshAccessToken: async () => 'refreshed-token',
    };

    const userRuntime = new GTRuntime({
      baseUrl: 'https://api.test.com',
      projectId: 'test-project',
      userTokenProvider,
    });
    expect(userTokenProvider.getAccessToken).not.toHaveBeenCalled();
    await userRuntime.translateMany([], options);

    expect(userTokenProvider.getAccessToken).toHaveBeenCalledTimes(1);
    const [input, init] = fetchMock.mock.calls[0];
    expect(new Request(input, init).headers.get('authorization')).toBe(
      'Bearer user-token'
    );
  });

  it('sends only the model provider in request metadata', async () => {
    await runtime.translateMany([], { ...options, modelProvider: 'OPENAI' });

    expect((await requestBody()).metadata).toEqual({ modelProvider: 'OPENAI' });
  });

  it('propagates network errors', async () => {
    const error = new Error('Network error');
    fetchMock.mockRejectedValue(error);

    await expect(runtime.translateMany([], options)).rejects.toBe(error);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
