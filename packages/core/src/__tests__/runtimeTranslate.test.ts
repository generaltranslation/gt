import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { API_VERSION } from '@generaltranslation/api';
import { GT } from '../index';
import { GTRuntime } from '../runtime';
import { translate, translateMany } from '../translate/runtimeTranslate';
import { createGtApiAdapter } from '../adapter/createGtApi';
import { defaultRuntimeApiUrl } from '../settings/settingsUrls';
import { defaultTimeout } from '../settings/settings';

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
    return Response.json(translations);
  };
  return { fetch: fetchImplementation, requests };
}

describe.sequential('runtime translate helpers', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  describe('behavioral parity across surfaces', () => {
    const { fetch: sharedFetch, requests } = captureRequests();
    beforeEach(() => {
      requests.length = 0;
      vi.stubGlobal('fetch', sharedFetch);
    });

    it('sends the same wire payload from the class, shared helper and adapter', async () => {
      const sources = [{ source: 'Hello', metadata: { context: 'greeting' } }];
      const options = { targetLocale: 'es-es', sourceLocale: 'en-us' };

      const fromRuntime = await new GTRuntime(config).translateMany(
        sources,
        options
      );
      const fromGt = await new GT(config).translateMany(sources, options);
      const fromNamed = await translateMany(sources, options, config);
      const fromAdapter = await createGtApiAdapter({
        ...config,
        fetch: sharedFetch,
      }).translateMany(sources, options);

      expect(requests).toHaveLength(4);
      const [first, ...rest] = requests;
      for (const request of rest) {
        expect(request.url.href).toBe(first.url.href);
        expect(request.body).toEqual(first.body);
        expect(request.headers.get('authorization')).toBe(
          first.headers.get('authorization')
        );
        expect(request.headers.get('gt-project-id')).toBe('test-project');
        expect(request.headers.get('gt-api-version')).toBe(API_VERSION);
      }
      expect(first.url.pathname).toBe('/v2/translate');
      expect(first.body).toMatchObject({
        targetLocale: 'es-ES',
        sourceLocale: 'en-US',
      });
      expect(fromGt).toEqual(fromRuntime);
      expect(fromNamed).toEqual(fromRuntime);
      expect(fromAdapter).toEqual(fromRuntime);
      expect(fromRuntime[0]).toMatchObject({ success: true, locale: 'es-ES' });
    });

    it('shares configured locale defaults across single and batch translation', async () => {
      const defaults = { sourceLocale: 'fr-fr', targetLocale: 'british' };
      const mappedConfig = {
        ...config,
        customMapping: { british: { code: 'en-gb' } },
      };
      const sources = { greeting: 'Hello' };
      const options = { targetLocale: '', sourceLocale: '' };
      const single = await translate('Hello', '', mappedConfig, defaults);
      const batch = await translateMany(
        sources,
        options,
        mappedConfig,
        defaults
      );

      for (const client of [
        new GTRuntime({ ...mappedConfig, ...defaults }),
        new GT({ ...mappedConfig, ...defaults }),
      ]) {
        expect(await client.translate('Hello', '')).toEqual(single);
        expect(await client.translateMany(sources, options)).toEqual(batch);
      }
      expect(requests).toHaveLength(6);
      for (const request of requests) {
        expect(request.body).toMatchObject({
          sourceLocale: 'fr-FR',
          targetLocale: 'en-GB',
        });
      }
    });

    it('keeps record keys, array order and string shorthand in the shared helpers', async () => {
      const record = await translateMany(
        { first: 'Hello', second: 'Goodbye' },
        'fr',
        config
      );
      expect(Object.keys(record)).toEqual(['first', 'second']);
      expect(requests[0].body.requests).toEqual({
        first: { source: 'Hello' },
        second: { source: 'Goodbye' },
      });

      const single = await translate('Hello', 'fr', config);
      expect(single).toMatchObject({ success: true, locale: 'fr' });
      expect(requests[1].body).toMatchObject({
        targetLocale: 'fr',
        sourceLocale: 'en',
      });
    });

    it('canonicalizes aliases through custom mapping without restoring them in results', async () => {
      const result = await translate('Hello', 'british', {
        ...config,
        customMapping: { british: { code: 'en-gb' } },
      });

      expect(requests[0].body.targetLocale).toBe('en-GB');
      expect(result).toMatchObject({ locale: 'en-GB' });
    });

    it('uses the runtime API URL when no base URL is configured', async () => {
      await translate('Hello', 'es', {
        projectId: 'test-project',
        apiKey: 'test-api-key',
      });

      expect(requests[0].url.origin).toBe(new URL(defaultRuntimeApiUrl).origin);
    });
  });

  describe('validation before fetch', () => {
    const fetchSpy = vi.fn<typeof fetch>();
    beforeEach(() => {
      fetchSpy.mockReset();
      vi.stubGlobal('fetch', fetchSpy);
      vi.stubEnv('GT_API_KEY', 'env-key');
      vi.stubEnv('GT_PROJECT_ID', 'env-project');
    });
    afterEach(() => vi.unstubAllEnvs());

    it('reports a missing key and project in class order and never reads the environment', async () => {
      await expect(translate('Hello', 'es', {})).rejects.toThrow(
        /API key[\s\S]*project ID/
      );
      await expect(
        translateMany(['Hello'], 'es', { apiKey: 'key' })
      ).rejects.toThrow('without a specified project ID');
      await expect(
        translateMany(['Hello'], 'es', { projectId: 'project' })
      ).rejects.toThrow('without a specified API key');
      expect(fetchSpy).not.toHaveBeenCalled();
    });

    it('requires a target locale after auth validation', async () => {
      await expect(
        translateMany(['Hello'], { targetLocale: '' }, config)
      ).rejects.toThrow('without a specified locale');
      await expect(
        createGtApiAdapter({ ...config, fetch: fetchSpy }).translate(
          'Hello',
          ''
        )
      ).rejects.toThrow('without a specified locale');
      expect(fetchSpy).not.toHaveBeenCalled();
    });

    it('accepts a user token provider in place of an API key', async () => {
      const { fetch: capture, requests } = captureRequests();
      const provider = {
        getAccessToken: vi.fn(async () => 'user-token'),
        refreshAccessToken: vi.fn(async () => undefined),
      };

      const adapter = createGtApiAdapter({
        baseUrl,
        projectId: 'test-project',
        userTokenProvider: provider,
        fetch: capture,
      });
      expect(provider.getAccessToken).not.toHaveBeenCalled();

      await adapter.translate('Hello', 'es');
      expect(provider.getAccessToken).toHaveBeenCalledTimes(1);
      expect(requests[0].headers.get('authorization')).toBe(
        'Bearer user-token'
      );
    });

    it('prefers the API key and retries a 401 once with a refreshed token', async () => {
      const provider = {
        getAccessToken: vi.fn(async () => 'stale-token'),
        refreshAccessToken: vi.fn(async () => 'fresh-token'),
      };
      const authorizations: (string | null)[] = [];
      const fetchImplementation: typeof fetch = async (input, init) => {
        const request = new Request(input, init);
        authorizations.push(request.headers.get('authorization'));
        return authorizations.length === 1
          ? new Response('unauthorized', { status: 401 })
          : Response.json({});
      };

      await translateMany(['Hello'], 'es', {
        projectId: 'test-project',
        userTokenProvider: provider,
        fetch: fetchImplementation,
      });
      expect(authorizations).toEqual([
        'Bearer stale-token',
        'Bearer fresh-token',
      ]);

      await translateMany(['Hello'], 'es', {
        ...config,
        userTokenProvider: provider,
        fetch: fetchImplementation,
      });
      expect(authorizations[2]).toBe('Bearer test-api-key');
      expect(provider.getAccessToken).toHaveBeenCalledTimes(1);
    });
  });

  describe('transport configuration', () => {
    it('honors an injected fetch and API version', async () => {
      const { fetch: capture, requests } = captureRequests();
      const globalFetch = vi.fn<typeof fetch>();
      vi.stubGlobal('fetch', globalFetch);

      await translate('Hello', 'es', {
        ...config,
        fetch: capture,
        apiVersion: '2026-03-06.v1',
      });

      expect(globalFetch).not.toHaveBeenCalled();
      expect(requests[0].headers.get('gt-api-version')).toBe('2026-03-06.v1');
    });

    it('resolves timeout as per-call override, then configured, then default', async () => {
      vi.useFakeTimers();
      const fetchImplementation: typeof fetch = (input, init) =>
        new Promise((_resolve, reject) => {
          const { signal } = new Request(input, init);
          signal.addEventListener('abort', () => reject(signal.reason));
        });
      const adapter = createGtApiAdapter({
        ...config,
        fetch: fetchImplementation,
        timeoutMs: 5_000,
      });

      const perCall = expect(
        adapter.translate('Hello', 'es', 1_000)
      ).rejects.toThrow('timed out after 1000ms');
      await vi.advanceTimersByTimeAsync(1_000);
      await perCall;

      const configured = expect(
        adapter.translate('Hello', 'es')
      ).rejects.toThrow('timed out after 5000ms');
      await vi.advanceTimersByTimeAsync(5_000);
      await configured;

      const runtimeDefault = expect(
        translate('Hello', 'es', { ...config, fetch: fetchImplementation })
      ).rejects.toThrow(`timed out after ${defaultTimeout}ms`);
      await vi.advanceTimersByTimeAsync(defaultTimeout);
      await runtimeDefault;
    });

    it('treats 0 as a literal zero and false as no runtime timer', async () => {
      vi.useFakeTimers();
      let resolveResponse: (() => void) | undefined;
      const fetchImplementation: typeof fetch = (input, init) =>
        new Promise((resolve, reject) => {
          const { signal } = new Request(input, init);
          signal.addEventListener('abort', () => reject(signal.reason));
          resolveResponse = () => resolve(Response.json({}));
        });

      const zero = expect(
        translate('Hello', 'es', {
          ...config,
          fetch: fetchImplementation,
          timeoutMs: 0,
        })
      ).rejects.toThrow('timed out after 0ms');
      await vi.advanceTimersByTimeAsync(0);
      await zero;

      const disabled = translate('Hello', 'es', {
        ...config,
        fetch: fetchImplementation,
        timeoutMs: false,
      });
      await vi.advanceTimersByTimeAsync(defaultTimeout * 10);
      resolveResponse?.();
      await expect(disabled).resolves.toMatchObject({ success: false });
    });

    it('keeps the legacy class zero timeout selecting the default', async () => {
      vi.useFakeTimers();
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

      const legacy = expect(
        new GTRuntime(config).translateMany(['Hello'], 'es', 0)
      ).rejects.toThrow(`timed out after ${defaultTimeout}ms`);
      await vi.advanceTimersByTimeAsync(defaultTimeout);
      await legacy;
    });

    it('does not retry translation even when the adapter configures management retries', async () => {
      const fetchSpy = vi.fn<typeof fetch>(
        async () => new Response('unavailable', { status: 503 })
      );
      const adapter = createGtApiAdapter({
        ...config,
        fetch: fetchSpy,
        retryPolicy: 'exponential',
      });

      await expect(adapter.translate('Hello', 'es')).rejects.toThrow(
        'unavailable'
      );
      expect(fetchSpy).toHaveBeenCalledTimes(1);
    });

    it('reads the latest adapter configuration after reconfiguration', async () => {
      const { fetch: capture, requests } = captureRequests();
      const adapter = createGtApiAdapter({ ...config, fetch: capture });

      adapter.configure({
        baseUrl: 'https://reconfigured.test',
        projectId: 'new-project',
        apiKey: 'new-key',
        fetch: capture,
        customMapping: { brand: { code: 'de-de' } },
      });
      await adapter.translate('Hello', 'brand');

      expect(requests[0].url.origin).toBe('https://reconfigured.test');
      expect(requests[0].headers.get('authorization')).toBe('Bearer new-key');
      expect(requests[0].headers.get('gt-project-id')).toBe('new-project');
      expect(requests[0].body.targetLocale).toBe('de-DE');
    });
  });
});
