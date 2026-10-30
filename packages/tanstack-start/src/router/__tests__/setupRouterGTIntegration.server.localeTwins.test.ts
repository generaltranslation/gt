import { beforeEach, describe, expect, it, vi } from 'vitest';
import { initializeI18nConfig } from '@generaltranslation/react-core/pure';

const {
  mockConditionStore,
  mockGetTranslationsSnapshot,
  mockLoadDictionary,
  responseHeaders,
} = vi.hoisted(() => ({
  mockGetTranslationsSnapshot: vi.fn(async () => ({ hello: 'bonjour' })),
  mockLoadDictionary: vi.fn(
    async (_locale: string): Promise<Record<string, unknown>> => ({})
  ),
  mockConditionStore: {
    getLocale: vi.fn(() => 'fr'),
    getRegion: vi.fn(() => undefined),
    getEnableI18n: vi.fn(() => true),
    isLocaleRoutingEnabled: vi.fn(() => false),
  },
  responseHeaders: { current: new Headers() },
}));

vi.mock('gt-react', () => ({
  GTProvider: () => null,
  getTranslationsSnapshot: mockGetTranslationsSnapshot,
  getReactI18nCache: () => ({ loadDictionary: mockLoadDictionary }),
  initializeGT: vi.fn(),
}));

vi.mock('@tanstack/react-start/server', () => ({
  getRequest: vi.fn(),
  setCookie: vi.fn(),
  getResponseHeader: (name: string) =>
    responseHeaders.current.get(name) ?? undefined,
  setResponseHeader: (name: string, value: string) =>
    responseHeaders.current.set(name, value),
}));

import type { AsyncLocalConditionStore } from '../../condition-store/AsyncLocalConditionStore';
import { setConditionStore } from '../../condition-store/singleton';
import { setupRouterGTIntegration } from '../setupRouterGTIntegration.server';
import type { GTRouterOptions } from '../types';

function createRouter({
  routeHeaders = [],
  isShell,
}: {
  routeHeaders?: Array<Record<string, string> | undefined>;
  isShell?: () => boolean;
} = {}) {
  const router = {
    options: {} as GTRouterOptions,
    isShell,
    state: { matches: routeHeaders.map((headers) => ({ headers })) },
    history: { location: { state: undefined }, replace: vi.fn() },
    update: vi.fn((next: Partial<GTRouterOptions>) => {
      router.options = { ...router.options, ...next };
    }),
  };
  return router;
}

function initialize(splitting: 'locale' | 'locale-twins') {
  Reflect.deleteProperty(globalThis, '__generaltranslation');
  initializeI18nConfig({
    defaultLocale: 'en',
    locales: ['en', 'fr'],
    files: { gt: { output: 'src/_gt/[locale].json', splitting } },
  });
  setConditionStore(mockConditionStore as unknown as AsyncLocalConditionStore);
}

describe.sequential('setupRouterGTIntegration server with locale twins', () => {
  beforeEach(() => {
    responseHeaders.current = new Headers();
    mockGetTranslationsSnapshot.mockClear();
    mockLoadDictionary.mockReset();
    mockLoadDictionary.mockResolvedValue({});
  });

  it('loads the request locale but sends no translations snapshot', async () => {
    initialize('locale-twins');
    const router = createRouter();
    setupRouterGTIntegration({ router });

    const dehydrated = (await router.options.dehydrate?.()) as {
      gt: Record<string, unknown>;
    };

    expect(mockGetTranslationsSnapshot).toHaveBeenCalledWith('fr');
    expect(dehydrated.gt).not.toHaveProperty('translations');
    expect(dehydrated.gt).toMatchObject({ locale: 'fr' });
  });

  // Dictionary entries are never twinned: their translations are in the
  // whole-locale snapshot
  it('sends the translations snapshot when the app has a dictionary', async () => {
    mockLoadDictionary.mockImplementation(async (locale) =>
      locale === 'en' ? { greeting: 'Hello' } : { greeting: 'Bonjour' }
    );
    initialize('locale-twins');
    const router = createRouter();
    setupRouterGTIntegration({ router });

    const dehydrated = (await router.options.dehydrate?.()) as {
      gt: Record<string, unknown>;
    };

    expect(dehydrated.gt.translations).toEqual({ hello: 'bonjour' });
  });

  // vite dev serves no twins: the client hydrates from the snapshot as
  // without locale twins
  it('sends the translations snapshot in development', async () => {
    vi.stubEnv('NODE_ENV', 'development');
    try {
      initialize('locale-twins');
      const router = createRouter();
      setupRouterGTIntegration({ router });

      const dehydrated = (await router.options.dehydrate?.()) as {
        gt: Record<string, unknown>;
      };

      expect(dehydrated.gt.translations).toEqual({ hello: 'bonjour' });
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it('marks documents as varying by locale cookie and Accept-Language', async () => {
    initialize('locale-twins');
    const router = createRouter({
      routeHeaders: [undefined, { Vary: 'Accept-Encoding' }],
    });
    setupRouterGTIntegration({ router });

    await router.options.dehydrate?.();

    expect(responseHeaders.current.get('vary')).toBe(
      'Accept-Encoding, Cookie, Accept-Language'
    );
    expect(responseHeaders.current.get('cache-control')).toBe(
      'private, no-cache'
    );
  });

  // Start builds the document Response from the matches' headers; H3 adds
  // the request-scoped response headers to 2xx responses only (not a 404)
  it('puts the document headers on the deepest match', async () => {
    initialize('locale-twins');
    const router = createRouter({
      routeHeaders: [{ 'X-Root': '1' }, { Vary: 'Accept-Encoding' }],
    });
    setupRouterGTIntegration({ router });

    await router.options.dehydrate?.();

    expect(router.state.matches.map((match) => match.headers)).toEqual([
      { 'X-Root': '1' },
      {
        vary: 'Accept-Encoding, Cookie, Accept-Language',
        'cache-control': 'private, no-cache',
      },
    ]);
  });

  // The request's own values are dropped from a 404 too, so they go on the
  // match even when locale twins add nothing to them
  it('puts the request headers it keeps on the deepest match', async () => {
    initialize('locale-twins');
    const router = createRouter({ routeHeaders: [{}] });
    responseHeaders.current.set('vary', 'Cookie, Accept-Language');
    responseHeaders.current.set('cache-control', 'no-store');
    setupRouterGTIntegration({ router });

    await router.options.dehydrate?.();

    expect(router.state.matches[0].headers).toEqual({
      vary: 'Cookie, Accept-Language',
      'cache-control': 'no-store',
    });
  });

  it("keeps the app's own Cache-Control", async () => {
    initialize('locale-twins');
    const router = createRouter({
      routeHeaders: [{ 'Cache-Control': 'private, max-age=60' }],
    });
    responseHeaders.current.set('vary', 'Origin');
    setupRouterGTIntegration({ router });

    await router.options.dehydrate?.();

    expect(responseHeaders.current.get('cache-control')).toBeNull();
    expect(responseHeaders.current.get('vary')).toBe(
      'Origin, Cookie, Accept-Language'
    );
  });

  it('sets no headers for a prerendered SPA shell', async () => {
    initialize('locale-twins');
    const router = createRouter({ isShell: () => true });
    setupRouterGTIntegration({ router });

    await router.options.dehydrate?.();

    expect([...responseHeaders.current]).toEqual([]);
  });

  it('changes nothing with locale splitting', async () => {
    initialize('locale');
    const router = createRouter();
    setupRouterGTIntegration({ router });

    const dehydrated = (await router.options.dehydrate?.()) as {
      gt: Record<string, unknown>;
    };

    expect(dehydrated.gt.translations).toEqual({ hello: 'bonjour' });
    expect([...responseHeaders.current]).toEqual([]);
  });
});
