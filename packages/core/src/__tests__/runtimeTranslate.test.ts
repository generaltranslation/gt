import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { API_VERSION } from '@generaltranslation/api';
import { GT } from '../index';
import { GTRuntime } from '../runtime';
import { defaultRuntimeApiUrl } from '../settings/settingsUrls';

const baseUrl = 'https://example.test';
const config = { projectId: 'test-project', apiKey: 'test-api-key', baseUrl };

type CapturedRequest = {
  url: URL;
  headers: Headers;
  body: { requests: Record<string, unknown>; targetLocale: string };
};

function captureRequests(): {
  fetch: typeof fetch;
  requests: CapturedRequest[];
} {
  const requests: CapturedRequest[] = [];
  const fetchImplementation: typeof fetch = async (input, init) => {
    const request = new Request(input, init);
    const body = JSON.parse(await request.text());
    requests.push({
      url: new URL(request.url),
      headers: request.headers,
      body,
    });
    const translations = Object.fromEntries(
      Object.keys(body.requests).map((hash) => [
        hash,
        {
          success: true,
          translation: `${hash}:${body.targetLocale}`,
          locale: body.targetLocale,
          dataFormat: 'STRING',
        },
      ])
    );
    return Response.json({ translations, generated: true });
  };
  return { fetch: fetchImplementation, requests };
}

describe.sequential('runtime translation', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  describe('GTRuntime and GT', () => {
    const { fetch: sharedFetch, requests } = captureRequests();
    beforeEach(() => {
      requests.length = 0;
      vi.stubGlobal('fetch', sharedFetch);
    });

    it('send the same wire payload', async () => {
      const sources = [{ source: 'Hello', metadata: { context: 'greeting' } }];
      const options = { targetLocale: 'es-es', sourceLocale: 'en-us' };

      const fromRuntime = await new GTRuntime(config).translateMany(
        sources,
        options
      );
      const fromGt = await new GT(config).translateMany(sources, options);

      expect(requests).toHaveLength(2);
      const [first, second] = requests;
      expect(second.url.href).toBe(first.url.href);
      expect(second.body).toEqual(first.body);
      expect(second.headers.get('authorization')).toBe(
        first.headers.get('authorization')
      );
      for (const request of requests) {
        expect(request.headers.has('gt-project-id')).toBe(false);
        expect(request.headers.get('gt-api-version')).toBe(API_VERSION);
      }
      expect(first.url.pathname).toBe('/v2/projects/test-project/translate');
      expect(first.body).toMatchObject({
        targetLocale: 'es-ES',
        sourceLocale: 'en-US',
      });
      expect(fromGt).toEqual(fromRuntime);
      expect(fromRuntime[0]).toMatchObject({ success: true, locale: 'es-ES' });
    });

    it('use the configured source locale for single and batch translation', async () => {
      const params = {
        ...config,
        localeConfig: {
          defaultLocale: 'fr-fr',
          customMapping: { british: { code: 'en-gb' } },
        },
      };
      const sources = { greeting: 'Hello' };
      const options = { targetLocale: 'british', sourceLocale: '' };

      for (const client of [new GTRuntime(params), new GT(params)]) {
        await client.translate('Hello', 'british');
        await client.translateMany(sources, options);
      }
      expect(requests).toHaveLength(4);
      for (const request of requests) {
        expect(request.body).toMatchObject({
          sourceLocale: 'fr-FR',
          targetLocale: 'en-GB',
        });
      }
    });

    it('keep record keys and accept the string shorthand', async () => {
      const runtime = new GTRuntime(config);
      const record = await runtime.translateMany(
        { first: 'Hello', second: 'Goodbye' },
        'fr'
      );
      expect(Object.keys(record)).toEqual(['first', 'second']);
      expect(requests[0].body.requests).toEqual({
        first: { source: 'Hello' },
        second: { source: 'Goodbye' },
      });

      const single = await runtime.translate('Hello', 'fr');
      expect(single).toMatchObject({ success: true, locale: 'fr' });
      expect(requests[1].body).toMatchObject({
        targetLocale: 'fr',
        sourceLocale: 'en',
      });
    });

    it('canonicalize aliases through custom mapping without restoring them in results', async () => {
      const result = await new GTRuntime({
        ...config,
        localeConfig: { customMapping: { british: { code: 'en-gb' } } },
      }).translate('Hello', 'british');

      expect(requests[0].body.targetLocale).toBe('en-GB');
      expect(result).toMatchObject({ locale: 'en-GB' });
    });

    it('use the runtime API URL when no base URL is configured', async () => {
      await new GTRuntime({
        projectId: 'test-project',
        apiKey: 'test-api-key',
      }).translate('Hello', 'es');

      expect(requests[0].url.origin).toBe(new URL(defaultRuntimeApiUrl).origin);
    });
  });

  describe('validation before fetch', () => {
    const fetchSpy = vi.fn<typeof fetch>();
    beforeEach(() => {
      fetchSpy.mockReset();
      vi.stubGlobal('fetch', fetchSpy);
    });

    it('requires a target locale', async () => {
      const runtime = new GTRuntime(config);
      await expect(
        runtime.translateMany(['Hello'], { targetLocale: '' })
      ).rejects.toThrow('without a target locale');
      await expect(runtime.translate('Hello', '')).rejects.toThrow(
        'without a target locale'
      );
      expect(fetchSpy).not.toHaveBeenCalled();
    });

    it('accepts a user token provider in place of an API key', async () => {
      const { fetch: capture, requests } = captureRequests();
      vi.stubGlobal('fetch', capture);
      const provider = {
        getAccessToken: vi.fn(async () => 'user-token'),
        refreshAccessToken: vi.fn(async () => undefined),
      };

      const project = new GTRuntime({
        baseUrl,
        userTokenProvider: provider,
        projectId: 'test-project',
      });
      expect(provider.getAccessToken).not.toHaveBeenCalled();

      await project.translate('Hello', 'es');
      expect(provider.getAccessToken).toHaveBeenCalledTimes(1);
      expect(requests[0].headers.get('authorization')).toBe(
        'Bearer user-token'
      );
    });
  });

  describe('transport', () => {
    function stubHangingFetch() {
      vi.stubGlobal(
        'fetch',
        vi.fn<typeof fetch>(
          (input, init) =>
            new Promise((_resolve, reject) => {
              const { signal } = new Request(input, init);
              signal.addEventListener('abort', () => reject(signal.reason));
            })
        )
      );
    }

    it('resolves timeout as per-call override, then the 60 second default', async () => {
      vi.useFakeTimers();
      stubHangingFetch();
      const project = new GTRuntime(config);

      const perCall = expect(
        project.translate('Hello', 'es', 1_000)
      ).rejects.toThrow('Request timed out after 1000ms');
      await vi.advanceTimersByTimeAsync(1_000);
      await perCall;

      const runtimeDefault = expect(
        project.translate('Hello', 'es')
      ).rejects.toThrow('Request timed out after 60000ms');
      await vi.advanceTimersByTimeAsync(60_000);
      await runtimeDefault;
    });

    it('treats a zero timeout as a literal zero', async () => {
      vi.useFakeTimers();
      stubHangingFetch();

      const zero = expect(
        new GTRuntime(config).translateMany(['Hello'], 'es', 0)
      ).rejects.toThrow('Request timed out after 0ms');
      await vi.advanceTimersByTimeAsync(0);
      await zero;
    });

    it('does not retry translation', async () => {
      const fetchSpy = vi.fn<typeof fetch>(
        async () => new Response('unavailable', { status: 503 })
      );
      vi.stubGlobal('fetch', fetchSpy);

      await expect(
        new GTRuntime(config).translate('Hello', 'es')
      ).rejects.toThrow('unavailable');
      expect(fetchSpy).toHaveBeenCalledTimes(1);
    });
  });
});
