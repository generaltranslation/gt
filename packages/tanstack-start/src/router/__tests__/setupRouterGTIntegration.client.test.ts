import type { ReactElement } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  mockConditionStore,
  mockCreateOrUpdateBrowserConditionStore,
  mockEnsureInitialized,
  mockGetTranslationsSnapshot,
  mockIsLocaleRouting,
} = vi.hoisted(() => ({
  mockConditionStore: {
    getLocale: vi.fn(() => 'fr'),
    getRegion: vi.fn(() => undefined),
    getEnableI18n: vi.fn(() => true),
  },
  mockCreateOrUpdateBrowserConditionStore: vi.fn(),
  mockEnsureInitialized: vi.fn(),
  mockGetTranslationsSnapshot: vi.fn(
    async (): Promise<Record<string, string>> => ({})
  ),
  mockIsLocaleRouting: vi.fn(() => true),
}));

vi.mock('gt-react', () => ({
  createOrUpdateBrowserConditionStore: mockCreateOrUpdateBrowserConditionStore,
  getTranslationsSnapshot: mockGetTranslationsSnapshot,
}));

vi.mock('@generaltranslation/react-core/pure', async (importOriginal) => ({
  ...(await importOriginal<
    typeof import('@generaltranslation/react-core/pure')
  >()),
  getReadonlyConditionStore: () => mockConditionStore,
}));

vi.mock('../../provider/GTProvider.client', () => ({ GTProvider: () => null }));

vi.mock('../../setup/initializeGT.client', () => ({
  ensureInitialized: mockEnsureInitialized,
  isLocaleRoutingEnabled: mockIsLocaleRouting,
}));

import { initializeI18nConfig } from '@generaltranslation/react-core/pure';
import { setupRouterGTIntegration } from '../setupRouterGTIntegration.client';
import type { GTRouterOptions } from '../types';

function createRouter(options: GTRouterOptions = {}) {
  const router = {
    options,
    update: vi.fn((next: Partial<GTRouterOptions>) => {
      router.options = { ...router.options, ...next };
    }),
  };
  return router;
}

type WrapComponent = (props: {
  children: string;
}) => ReactElement<{ children: ReactElement<Record<string, unknown>> }>;

function renderOrSuspend(Wrap: WrapComponent): unknown {
  try {
    return Wrap({ children: 'app' });
  } catch (thrown) {
    return thrown;
  }
}

function rewritePathname(
  options: GTRouterOptions,
  direction: 'input' | 'output',
  pathname: string
) {
  const url = new URL(`https://example.com${pathname}`);
  const result = options.rewrite?.[direction]?.({ url });
  return result instanceof URL ? result.pathname : url.pathname;
}

const gtState = {
  locale: 'zh',
  region: 'TW',
  enableI18n: true,
  translations: {},
};

describe.sequential('setupRouterGTIntegration client', () => {
  beforeEach(() => {
    Reflect.deleteProperty(globalThis, '__generaltranslation');
    initializeI18nConfig({ defaultLocale: 'en', locales: ['en', 'fr', 'zh'] });
    mockCreateOrUpdateBrowserConditionStore.mockReset();
    mockEnsureInitialized.mockClear();
    mockGetTranslationsSnapshot.mockClear();
    mockIsLocaleRouting.mockReturnValue(true);
  });

  it('installs the locale rewrite at setup, before hydration', () => {
    const router = createRouter();

    setupRouterGTIntegration({ router });

    expect(mockEnsureInitialized).toHaveBeenCalledOnce();
    expect(router.update).toHaveBeenCalledOnce();
    expect(rewritePathname(router.options, 'input', '/fr/about')).toBe(
      '/about'
    );
    expect(rewritePathname(router.options, 'output', '/about')).toBe(
      '/fr/about'
    );
  });

  it('applies hydrated GT state before the app hydrate callback', async () => {
    const appHydrate = vi.fn();
    const router = createRouter({ hydrate: appHydrate });
    setupRouterGTIntegration({ router });

    const dehydrated = { app: true, gt: gtState };
    await router.options.hydrate?.(dehydrated);

    expect(mockCreateOrUpdateBrowserConditionStore).toHaveBeenCalledWith({
      locale: 'zh',
      region: 'TW',
      enableI18n: true,
    });
    expect(appHydrate).toHaveBeenCalledWith(dehydrated);
    expect(
      mockCreateOrUpdateBrowserConditionStore.mock.invocationCallOrder[0]
    ).toBeLessThan(appHydrate.mock.invocationCallOrder[0]);
  });

  it('still calls the app hydrate callback without GT state', async () => {
    const appHydrate = vi.fn();
    const router = createRouter({ hydrate: appHydrate });
    setupRouterGTIntegration({ router });

    await router.options.hydrate?.({ app: true });

    expect(mockCreateOrUpdateBrowserConditionStore).not.toHaveBeenCalled();
    expect(appHydrate).toHaveBeenCalledWith({ app: true });
  });

  it('leaves the app rewrite alone when opted out', () => {
    const appRewrite = { input: vi.fn() };
    const router = createRouter({ rewrite: appRewrite });

    setupRouterGTIntegration({ router, localeRewrite: false });

    expect(router.update.mock.calls[0][0]).not.toHaveProperty('rewrite');
    expect(router.options.rewrite).toBe(appRewrite);
  });

  it('leaves the app rewrite alone when locale routing is off', () => {
    mockIsLocaleRouting.mockReturnValue(false);
    const router = createRouter();

    setupRouterGTIntegration({ router });

    expect(router.options.rewrite).toBeUndefined();
  });

  it('renders hydrated GT state without suspending', async () => {
    const router = createRouter();
    setupRouterGTIntegration({ router });
    await router.options.hydrate?.({ gt: gtState });
    const Wrap = router.options.Wrap as unknown as WrapComponent;

    expect(Wrap({ children: 'app' }).props.children.props).toEqual({
      ...gtState,
      children: 'app',
    });
    expect(mockGetTranslationsSnapshot).not.toHaveBeenCalled();
  });

  it('suspends Wrap without hydrated state until the client state loads', async () => {
    mockGetTranslationsSnapshot.mockResolvedValueOnce({ hello: 'bonjour' });
    const router = createRouter();
    setupRouterGTIntegration({ router });
    const Wrap = router.options.Wrap as unknown as WrapComponent;

    const suspended = renderOrSuspend(Wrap);
    expect(suspended).toBeInstanceOf(Promise);
    // The same pending promise is thrown until it settles.
    expect(renderOrSuspend(Wrap)).toBe(suspended);
    await suspended;

    expect(Wrap({ children: 'app' }).props.children.props).toEqual({
      locale: 'fr',
      region: undefined,
      enableI18n: true,
      translations: { hello: 'bonjour' },
      children: 'app',
    });
  });

  it('throws the load error from Wrap once client state fails to load', async () => {
    const error = new Error('load failed');
    mockGetTranslationsSnapshot.mockRejectedValueOnce(error);
    const router = createRouter();
    setupRouterGTIntegration({ router });
    const Wrap = router.options.Wrap as unknown as WrapComponent;

    await expect(renderOrSuspend(Wrap)).rejects.toBe(error);
    expect(renderOrSuspend(Wrap)).toBe(error);
  });

  it('integrates a router only once', async () => {
    const appHydrate = vi.fn();
    const router = createRouter({ hydrate: appHydrate });

    setupRouterGTIntegration({ router });
    setupRouterGTIntegration({ router });
    await router.options.hydrate?.({ gt: gtState });

    expect(router.update).toHaveBeenCalledOnce();
    expect(appHydrate).toHaveBeenCalledOnce();
    expect(mockCreateOrUpdateBrowserConditionStore).toHaveBeenCalledOnce();
  });
});
