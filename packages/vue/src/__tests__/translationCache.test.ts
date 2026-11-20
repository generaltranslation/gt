import { defaultCacheUrl } from 'generaltranslation/internal';
import { hashStringMessage } from 'gt-i18n/internal/string';
import { defineComponent, h } from 'vue';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { T, createGT, initializeGT, useGT } from '../index';
import {
  mount,
  renderWithPlugin,
  resetI18nSingletons,
  textContent,
} from './testUtils';

const stringHash = hashStringMessage('Hi');

type TranslateRequest = {
  source: unknown;
  metadata: { dataFormat: string };
};

describe('gt-vue translation cache', () => {
  afterEach(() => {
    resetI18nSingletons();
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it('loads translations from the GT CDN without a loader', async () => {
    const fetch = vi.fn(async () => Response.json({ [stringHash]: 'Salut' }));
    vi.stubGlobal('fetch', fetch);
    initializeGT({ projectId: 'project-id', locales: ['fr'] });
    const plugin = createGT({ locale: 'fr' });
    const Root = defineComponent({
      setup() {
        const t = useGT();
        return () => t('Hi');
      },
    });

    await plugin.loadTranslations('fr');
    const mounted = mount(Root, plugin);

    expect(textContent(mounted.root)).toBe('Salut');
    expect(fetch).toHaveBeenCalledWith(`${defaultCacheUrl}/project-id/fr`);
    mounted.app.unmount();
  });

  it('requests missing T and string translations in development and rerenders', async () => {
    vi.stubEnv('NODE_ENV', 'development');
    const requests: TranslateRequest[] = [];
    const fetch = vi.fn(async (request: Request) => {
      const body = (await request.json()) as { requests: TranslateRequest[] };
      requests.push(...body.requests);
      return Response.json({
        results: body.requests.map(({ metadata }) => ({
          status: 'succeeded',
          translation:
            metadata.dataFormat === 'JSX'
              ? { t: 'b', i: 1, c: 'Bonjour' }
              : 'Salut',
          dataFormat: metadata.dataFormat,
          locale: 'fr',
        })),
      });
    });
    vi.stubGlobal('fetch', fetch);
    initializeGT({
      apiKey: 'api-key',
      projectId: 'project-id',
      runtimeUrl: 'https://runtime.test',
      loadTranslations: async () => ({}),
    });
    const plugin = createGT({ locale: 'fr' });
    await plugin.loadTranslations('fr');
    const Root = defineComponent({
      setup() {
        const t = useGT();
        return () => [
          h(T, null, { default: () => h('b', 'Hello') }),
          '|',
          t('Hi'),
        ];
      },
    });

    const mounted = mount(Root, plugin);
    expect(textContent(mounted.root)).toBe('Hello|Hi');

    await vi.waitFor(() =>
      expect(textContent(mounted.root)).toBe('Bonjour|Salut')
    );
    expect(fetch).toHaveBeenCalledOnce();
    const request = fetch.mock.calls[0]![0];
    expect(request.url).toBe(
      'https://runtime.test/v2/projects/project-id/translate'
    );
    expect(request.headers.get('authorization')).toBe('Bearer api-key');
    expect(requests.map(({ source }) => source)).toEqual(
      expect.arrayContaining([{ t: 'b', i: 1, c: 'Hello' }, 'Hi'])
    );
    expect(requests).toHaveLength(2);
    mounted.app.unmount();
  });

  it('renders loaded translations after their cache entry expires', async () => {
    initializeGT({
      cacheExpiryTime: 0,
      locales: ['fr'],
      loadTranslations: async () => ({ [stringHash]: 'Salut' }),
    });
    const plugin = createGT({ locale: 'fr' });
    const Root = defineComponent({
      setup() {
        const t = useGT();
        return () => t('Hi');
      },
    });

    await plugin.loadTranslations('fr');

    expect(await renderWithPlugin(Root, plugin)).toBe('Salut');
  });

  it('retries a failed development translation request on a later render', async () => {
    vi.stubEnv('NODE_ENV', 'development');
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const fetch = vi
      .fn()
      .mockRejectedValueOnce(new Error('offline'))
      .mockImplementation(async (request: Request) => {
        const body = (await request.json()) as {
          requests: TranslateRequest[];
        };
        return Response.json({
          results: body.requests.map(({ metadata }) => ({
            status: 'succeeded',
            translation: 'Salut',
            dataFormat: metadata.dataFormat,
            locale: 'fr',
          })),
        });
      });
    vi.stubGlobal('fetch', fetch);
    initializeGT({
      apiKey: 'api-key',
      projectId: 'project-id',
      runtimeUrl: 'https://runtime.test',
      loadTranslations: async () => ({}),
    });
    const plugin = createGT({ locale: 'fr' });
    await plugin.loadTranslations('fr');
    const Root = defineComponent({
      setup() {
        const t = useGT();
        return () => t('Hi');
      },
    });

    const mounted = mount(Root, plugin);
    await vi.waitFor(() => expect(warn).toHaveBeenCalledOnce());
    expect(textContent(mounted.root)).toBe('Hi');

    await plugin.setLocale('fr');
    await vi.waitFor(() => expect(textContent(mounted.root)).toBe('Salut'));
    await plugin.setLocale('fr');

    expect(fetch).toHaveBeenCalledTimes(2);
    mounted.app.unmount();
    warn.mockRestore();
  });
});
