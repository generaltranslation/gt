// @vitest-environment jsdom
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const {
  mockGetI18nConfig,
  mockGTProvider,
  mockInitializeGTClient,
  mockPathname,
  mockRefreshServerComponents,
  mockReloadBrowserPage,
} = vi.hoisted(() => ({
  mockGetI18nConfig: vi.fn(),
  mockGTProvider: vi.fn(
    ({ children }: { children?: React.ReactNode }) => children
  ),
  mockInitializeGTClient: vi.fn(),
  mockPathname: vi.fn(),
  mockRefreshServerComponents: vi.fn(),
  mockReloadBrowserPage: vi.fn(),
}));

vi.mock('gt-i18n/internal', async (importOriginal) => ({
  ...(await importOriginal<typeof import('gt-i18n/internal')>()),
  getI18nConfig: mockGetI18nConfig,
}));

vi.mock('gt-react', () => ({
  GTProvider: mockGTProvider,
  LocaleSelector: () => null,
  RegionSelector: () => null,
}));

vi.mock('next/navigation', () => ({
  usePathname: mockPathname,
  useRouter: () => ({ refresh: mockRefreshServerComponents }),
}));

vi.mock('../../setup/initGT.client', () => ({
  initializeGTClient: mockInitializeGTClient,
}));

const ROUTING_COOKIE = 'generaltranslation.locale-routing-enabled';
const EVERY_PATH = '.*';
const roots: Root[] = [];

type Conditions = { locale: string; region?: string; enableI18n?: boolean };
type ProviderProps = Conditions & { _reload: (conditions: Conditions) => void };

function stubPathname(pathname: string) {
  mockPathname.mockReturnValue(pathname);
  vi.stubGlobal('location', { pathname, reload: mockReloadBrowserPage });
}

function stubI18nConfig(overrides: Record<string, unknown> = {}) {
  mockGetI18nConfig.mockReturnValue({
    determineLocale: vi.fn(),
    getDefaultLocale: () => 'en',
    getLocales: () => ['en', 'en-GB', 'fr'],
    isGTServicesEnabled: () => false,
    resolveAliasLocale: (locale: string) => locale,
    standardizeLocale: (locale: string) => locale,
    ...overrides,
  });
}

/**
 * Mounts the provider from a freshly loaded module (pathRegex is compiled
 * at module load) and returns the props it passed to gt-react's GTProvider.
 */
async function mount(conditions: Conditions, supportsLocaleRefresh = true) {
  const { Client_GTProvider } = await import('../client-boundary');
  const root = createRoot(document.createElement('div'));
  roots.push(root);
  await act(async () =>
    root.render(
      <Client_GTProvider
        supportsLocaleRefresh={supportsLocaleRefresh}
        {...conditions}
        dictionaries={{}}
        translations={{}}
      >
        content
      </Client_GTProvider>
    )
  );
  return mockGTProvider.mock.calls.at(-1)![0] as unknown as ProviderProps;
}

async function unmountAll() {
  for (const root of roots.splice(0)) await act(async () => root.unmount());
}

function expectSync(expected: { refresh?: number; reload?: number }) {
  expect(mockRefreshServerComponents).toHaveBeenCalledTimes(
    expected.refresh ?? 0
  );
  expect(mockReloadBrowserPage).toHaveBeenCalledTimes(expected.reload ?? 0);
}

describe('Client_GTProvider', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    // By default the current path is excluded from locale routing.
    stubPathname('/uk');
    vi.stubEnv('_GENERALTRANSLATION_PATH_REGEX', '^/(?!uk(?:/|$)).*');
    document.cookie = `${ROUTING_COOKIE}=true;path=/`;
    stubI18nConfig();
    globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  });

  afterEach(async () => {
    await unmountAll();
    vi.unstubAllEnvs();
    document.cookie = `${ROUTING_COOKIE}=;max-age=0;path=/`;
    vi.unstubAllGlobals();
    globalThis.IS_REACT_ACT_ENVIRONMENT = false;
  });

  it.each([false, true])(
    'uses the version fallback for condition updates (supported: %s)',
    async (supportsLocaleRefresh) => {
      vi.stubEnv('_GENERALTRANSLATION_PATH_REGEX', EVERY_PATH);
      stubPathname('/fr-FR');
      mockGetI18nConfig.mockReturnValue({
        determineLocale: ([locale]: string[]) => locale,
        getDefaultLocale: () => 'en-US',
        getLocales: () => ['en-US', 'fr-FR', 'de-DE'],
      });
      const conditions = { locale: 'fr-FR', region: 'FR', enableI18n: true };
      const sync = supportsLocaleRefresh ? 'refresh' : 'reload';

      const providerProps = await mount(conditions, supportsLocaleRefresh);

      expect(providerProps).not.toHaveProperty('supportsLocaleRefresh');
      expect(providerProps).toMatchObject(conditions);
      // The client cannot know whether middleware will accept or reject German.
      providerProps._reload({ ...conditions, locale: 'de-DE' });
      expectSync({ [sync]: 1 });
      vi.clearAllMocks();
      providerProps._reload({ ...conditions, region: 'GB' });
      providerProps._reload({ ...conditions, enableI18n: false });
      expectSync({ [sync]: 2 });
    }
  );

  it.each([false, true])(
    'does not reload the configured default locale after remounts (GT services: %s)',
    async (gtServicesEnabled) => {
      vi.stubEnv('_GENERALTRANSLATION_PATH_REGEX', EVERY_PATH);
      mockPathname.mockReturnValue('/pricing');
      const { I18nConfig } = await import('gt-i18n/internal');
      const config = new I18nConfig({
        defaultLocale: 'en-us',
        locales: ['en-us', 'fr'],
        projectId: gtServicesEnabled ? 'locale-comparison-test' : undefined,
        runtimeUrl: gtServicesEnabled ? undefined : null,
        cacheUrl: gtServicesEnabled ? undefined : null,
      });
      expect(config.isGTServicesEnabled()).toBe(gtServicesEnabled);
      mockGetI18nConfig.mockReturnValue(config);

      for (let mounts = 0; mounts < 3; mounts++) {
        // Middleware restores this cookie on every document request.
        document.cookie = `${ROUTING_COOKIE}=true;path=/`;
        await mount({ locale: 'en-us' });
        await unmountAll();
      }

      expectSync({});
      expect(document.cookie).toContain(`${ROUTING_COOKIE}=true`);
    }
  );

  it.each([false, true])(
    'reconciles differing path/provider locales (refresh supported: %s)',
    async (supportsLocaleRefresh) => {
      vi.stubEnv('_GENERALTRANSLATION_PATH_REGEX', EVERY_PATH);
      mockPathname.mockReturnValue('/pricing');
      const { I18nConfig } = await import('gt-i18n/internal');
      mockGetI18nConfig.mockReturnValue(
        new I18nConfig({
          defaultLocale: 'en',
          locales: ['en', 'en-GB'],
          runtimeUrl: null,
          cacheUrl: null,
        })
      );

      await mount({ locale: 'en-GB' }, supportsLocaleRefresh);

      expectSync({ [supportsLocaleRefresh ? 'refresh' : 'reload']: 1 });
    }
  );

  it('does not refresh excluded paths when the routing cookie is stale', async () => {
    await mount({ locale: 'en-GB' });

    expect(mockGetI18nConfig).toHaveBeenCalled();
    expectSync({});
  });

  // Each case selects the default locale through the provider's _reload().
  const firstCandidate = ([locale]: string[]) => locale;
  it.each([
    {
      name: 'reloads the browser page when switching to the default locale',
      pathname: '/pt-BR',
      locale: 'pt-BR',
      config: {
        determineLocale: firstCandidate,
        getLocales: () => ['en', 'pt-BR'],
      },
      expected: { reload: 1 },
    },
    {
      name: 'refreshes when reselecting the default locale on an unprefixed path',
      pathname: '/dashboard',
      locale: 'en',
      config: {
        determineLocale: (locales: string[]) =>
          locales.find((locale) => ['en', 'fr'].includes(locale)),
        getLocales: () => ['en', 'fr'],
      },
      expected: { refresh: 1 },
    },
    {
      name: 'reloads when an explicit locale prefix aliases the default locale',
      pathname: '/en-US/dashboard',
      locale: 'en',
      config: {
        determineLocale: firstCandidate,
        getLocales: () => ['en', 'fr'],
        resolveAliasLocale: (locale: string) =>
          locale === 'en-US' ? 'en' : locale,
      },
      expected: { reload: 1 },
    },
    {
      name: 'refreshes server content on excluded paths',
      pathRegex: '^/(?!fr/favicon\\.ico(?:/|$)).*',
      pathname: '/fr/favicon.ico',
      locale: 'fr',
      config: { getLocales: () => ['en', 'fr'] },
      expected: { refresh: 1 },
    },
    {
      name: 'refreshes server content without locale routing',
      // The default excluded /uk path, but without the routing cookie.
      routingCookie: false,
      locale: 'fr',
      expected: { refresh: 1 },
    },
  ])(
    '$name',
    async ({
      pathRegex = EVERY_PATH,
      pathname,
      locale,
      config,
      routingCookie = true,
      expected,
    }) => {
      if (pathname) {
        vi.stubEnv('_GENERALTRANSLATION_PATH_REGEX', pathRegex);
        stubPathname(pathname);
      }
      if (!routingCookie) {
        document.cookie = `${ROUTING_COOKIE}=;max-age=0;path=/`;
      }
      stubI18nConfig(config);

      const { _reload } = await mount({ locale });
      _reload({ enableI18n: true, locale: 'en', region: undefined });

      expectSync(expected);
    }
  );
});
