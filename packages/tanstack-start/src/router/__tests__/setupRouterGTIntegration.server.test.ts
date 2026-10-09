import type { ReactElement } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { initializeI18nConfig } from '@generaltranslation/react-core/pure';

const { mockConditionStore, mockLoadDictionary } = vi.hoisted(() => ({
  mockLoadDictionary: vi.fn(async (locale: string) => ({ greeting: locale })),
  mockConditionStore: {
    getLocale: vi.fn(() => 'fr'),
    getRegion: vi.fn(() => undefined),
    getEnableI18n: vi.fn(() => true),
    isLocaleRoutingEnabled: vi.fn(() => true),
  },
}));

vi.mock('gt-react', () => ({
  GTProvider: () => null,
  getTranslationsSnapshot: vi.fn(async () => ({ hello: 'bonjour' })),
  getReactI18nCache: () => ({ loadDictionary: mockLoadDictionary }),
  initializeGT: vi.fn(),
}));

vi.mock('@tanstack/react-start/server', () => ({
  getRequest: vi.fn(() => {
    throw new Error('No StartEvent found in AsyncLocalStorage.');
  }),
  setCookie: vi.fn(),
}));

import { AsyncLocalConditionStore } from '../../condition-store/AsyncLocalConditionStore';
import { setConditionStore } from '../../condition-store/singleton';
import { setupRouterGTIntegration } from '../setupRouterGTIntegration.server';
import type { GTRouterOptions } from '../types';

function createRouter(options: GTRouterOptions = {}, isShell?: () => boolean) {
  const router = {
    options,
    isShell,
    update: vi.fn((next: Partial<GTRouterOptions>) => {
      router.options = { ...router.options, ...next };
    }),
  };
  return router;
}

function output(options: GTRouterOptions, pathname: string) {
  const url = new URL(`https://example.com${pathname}`);
  const result = options.rewrite?.output?.({ url });
  return result instanceof URL ? result.pathname : url.pathname;
}

describe.sequential('setupRouterGTIntegration server', () => {
  beforeEach(() => {
    Reflect.deleteProperty(globalThis, '__generaltranslation');
    initializeI18nConfig({ defaultLocale: 'en', locales: ['en', 'fr'] });
    setConditionStore(
      mockConditionStore as unknown as AsyncLocalConditionStore
    );
    mockConditionStore.isLocaleRoutingEnabled.mockReturnValue(true);
    mockConditionStore.getLocale.mockReturnValue('fr');
  });

  it('installs the locale rewrite through router.update when locale routing is on', () => {
    const router = createRouter();

    setupRouterGTIntegration({ router });

    expect(router.update).toHaveBeenCalledOnce();
    expect(router.update.mock.calls[0][0]).toMatchObject({
      rewrite: expect.any(Object),
      dehydrate: expect.any(Function),
      Wrap: expect.any(Function),
    });
    expect(output(router.options, '/about')).toBe('/fr/about');
  });

  it('reads the request locale each time output runs', () => {
    const router = createRouter();
    setupRouterGTIntegration({ router });

    expect(output(router.options, '/about')).toBe('/fr/about');
    mockConditionStore.getLocale.mockReturnValue('en');
    expect(output(router.options, '/about')).toBe('/about');
  });

  it('reads locale routing from a store initialized through another entrypoint', () => {
    // The main and /server entrypoints bundle their own copy of initializeGT;
    // only the global condition store is shared between them.
    const conditionStore = new AsyncLocalConditionStore({
      defaultLocale: 'en',
      locales: ['en', 'fr'],
      localeRouting: true,
    });
    setConditionStore(conditionStore);
    const router = createRouter();

    setupRouterGTIntegration({ router });

    expect(router.update.mock.calls[0][0]).toHaveProperty('rewrite');
    expect(
      conditionStore.run(new Request('https://example.com/fr/about'), () =>
        output(router.options, '/about')
      )
    ).toBe('/fr/about');
  });

  it('composes with the app rewrite', () => {
    const appRewrite = {
      output: ({ url }: { url: URL }) =>
        url.pathname === '/about' ? 'https://example.com/legacy' : undefined,
    };
    const router = createRouter({ rewrite: appRewrite });

    setupRouterGTIntegration({ router });

    expect(router.options.rewrite).not.toBe(appRewrite);
    expect(output(router.options, '/about')).toBe('/fr/legacy');
  });

  it.each([
    { name: 'opted out', localeRouting: true, localeRewrite: false as const },
    { name: 'locale routing is off', localeRouting: false },
  ])(
    'leaves the app rewrite alone when $name',
    ({ localeRouting, localeRewrite }) => {
      mockConditionStore.isLocaleRoutingEnabled.mockReturnValue(localeRouting);
      const appRewrite = { input: vi.fn() };
      const router = createRouter({ rewrite: appRewrite });

      setupRouterGTIntegration({ router, localeRewrite });

      expect(router.update.mock.calls[0][0]).not.toHaveProperty('rewrite');
      expect(router.options.rewrite).toBe(appRewrite);
    }
  );

  it('integrates a router only once', () => {
    const router = createRouter();

    setupRouterGTIntegration({ router });
    const { rewrite, dehydrate, Wrap } = router.options;
    setupRouterGTIntegration({ router });

    expect(router.update).toHaveBeenCalledOnce();
    expect(router.options).toMatchObject({ rewrite, dehydrate, Wrap });
  });

  it('adds GT state to the app dehydrated data', async () => {
    const router = createRouter({ dehydrate: () => ({ app: true }) });

    setupRouterGTIntegration({ router });

    await expect(router.options.dehydrate?.()).resolves.toEqual({
      app: true,
      gt: {
        locale: 'fr',
        region: undefined,
        enableI18n: true,
        translations: { hello: 'bonjour' },
        dictionaries: { fr: { greeting: 'fr' } },
      },
    });
  });

  it('suspends Wrap until the request state loads, then renders it', async () => {
    const router = createRouter();
    setupRouterGTIntegration({ router });
    const Wrap = router.options.Wrap as unknown as (props: {
      children: string;
    }) => ReactElement<{ children: ReactElement<Record<string, unknown>> }>;

    let suspended: unknown;
    try {
      Wrap({ children: 'app' });
    } catch (thrown) {
      suspended = thrown;
    }
    expect(suspended).toBeInstanceOf(Promise);
    await suspended;

    expect(Wrap({ children: 'app' }).props.children.props).toEqual({
      locale: 'fr',
      region: undefined,
      enableI18n: true,
      translations: { hello: 'bonjour' },
      dictionaries: { fr: { greeting: 'fr' } },
      children: 'app',
    });
  });

  it('loads the dictionary for a translated locale only', async () => {
    const router = createRouter();
    setupRouterGTIntegration({ router });

    await expect(router.options.dehydrate?.()).resolves.toMatchObject({
      gt: { dictionaries: { fr: { greeting: 'fr' } } },
    });
    expect(mockLoadDictionary).toHaveBeenCalledWith('fr');

    // Both sides bundle the source dictionary for the default locale.
    mockLoadDictionary.mockClear();
    mockConditionStore.getLocale.mockReturnValue('en');
    const defaultRouter = createRouter();
    setupRouterGTIntegration({ router: defaultRouter });
    await expect(defaultRouter.options.dehydrate?.()).resolves.toMatchObject({
      gt: { locale: 'en', dictionaries: {} },
    });
    expect(mockLoadDictionary).not.toHaveBeenCalled();
  });

  it('marks the GT state of a prerendered SPA shell', async () => {
    let shell = false;
    const router = createRouter(
      { dehydrate: () => ({ app: true }) },
      () => shell
    );

    setupRouterGTIntegration({ router });
    // Start marks the shell render after the router is created.
    shell = true;

    await expect(router.options.dehydrate?.()).resolves.toEqual({
      app: true,
      gt: {
        locale: 'fr',
        region: undefined,
        enableI18n: true,
        translations: { hello: 'bonjour' },
        dictionaries: { fr: { greeting: 'fr' } },
        shell: true,
      },
    });
  });
});
