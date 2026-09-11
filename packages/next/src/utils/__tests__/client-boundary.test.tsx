// @vitest-environment jsdom
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { defaultLocaleCookieName } from 'gt-i18n/internal/cookies';

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

describe('Client_GTProvider', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    vi.stubGlobal('location', {
      pathname: '/uk',
      reload: mockReloadBrowserPage,
    });
    mockPathname.mockReturnValue('/uk');
    process.env._GENERALTRANSLATION_PATH_REGEX = '^/(?!uk(?:/|$)).*';
    document.cookie = 'generaltranslation.locale-routing-enabled=true;path=/';
    mockGetI18nConfig.mockReturnValue({
      determineLocale: vi.fn(),
      getDefaultLocale: () => 'en',
      getLocaleCookieName: () => defaultLocaleCookieName,
      getLocales: () => ['en', 'en-GB', 'fr'],
      isGTServicesEnabled: () => false,
      resolveAliasLocale: (locale: string) => locale,
      standardizeLocale: (locale: string) => locale,
    });
    globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  });

  afterEach(() => {
    delete process.env._GENERALTRANSLATION_PATH_REGEX;
    delete process.env._GENERALTRANSLATION_LOCALE_ROUTING_ENABLED_COOKIE_NAME;
    delete process.env._GENERALTRANSLATION_RESET_LOCALE_COOKIE_NAME;
    delete process.env._GENERALTRANSLATION_BASE_PATH;
    document.cookie =
      'generaltranslation.locale-routing-enabled=;max-age=0;path=/';
    document.cookie = 'custom-routing-enabled=;max-age=0;path=/';
    vi.unstubAllGlobals();
    globalThis.IS_REACT_ACT_ENVIRONMENT = false;
  });

  it('gates the routing locale cookie name on the live enabled flag', async () => {
    process.env._GENERALTRANSLATION_PATH_REGEX = '.*';
    mockPathname.mockReturnValue('/dashboard');
    vi.stubGlobal('location', {
      pathname: '/dashboard',
      reload: mockReloadBrowserPage,
    });
    const { Client_GTProvider } = await import('../client-boundary');
    const container = document.createElement('div');
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <Client_GTProvider dictionaries={{}} locale='en' translations={{}}>
          content
        </Client_GTProvider>
      );
    });

    expect(
      mockGTProvider.mock.calls.at(-1)?.[0]._localeRouting.cookieName
    ).toBe('generaltranslation.routing-fetch-locale');
    const isLocaleRoutingEnabled =
      mockGTProvider.mock.calls.at(-1)?.[0]._localeRouting.isEnabled;
    expect(isLocaleRoutingEnabled()).toBe(true);

    document.cookie = 'generaltranslation.locale-routing-enabled=false;path=/';
    expect(isLocaleRoutingEnabled()).toBe(false);

    document.cookie =
      'generaltranslation.locale-routing-enabled=;max-age=0;path=/';
    expect(isLocaleRoutingEnabled()).toBe(false);

    document.cookie = 'generaltranslation.locale-routing-enabled=true;path=/';
    expect(isLocaleRoutingEnabled()).toBe(true);

    await act(async () => root.unmount());
  });

  it.each([
    ['app-b-current', 'app-b-current.routing-fetch'],
    ['NEXT_LOCALE', 'NEXT_LOCALE.routing-fetch'],
  ])(
    'keeps the pending locale in the configured %s namespace',
    async (currentCookie, requestedCookie) => {
      mockGetI18nConfig.mockReturnValue({
        ...mockGetI18nConfig(),
        getLocaleCookieName: () => currentCookie,
      });
      const { Client_GTProvider } = await import('../client-boundary');
      const root = createRoot(document.createElement('div'));
      await act(async () => {
        root.render(
          <Client_GTProvider dictionaries={{}} locale='en' translations={{}} />
        );
      });
      expect(
        mockGTProvider.mock.calls.at(-1)?.[0]._localeRouting.cookieName
      ).toBe(requestedCookie);
      await act(async () => root.unmount());
    }
  );

  it('uses the configured locale-routing enabled flag name', async () => {
    process.env._GENERALTRANSLATION_PATH_REGEX = '.*';
    process.env._GENERALTRANSLATION_LOCALE_ROUTING_ENABLED_COOKIE_NAME =
      'custom-routing-enabled';
    process.env._GENERALTRANSLATION_RESET_LOCALE_COOKIE_NAME = 'custom-reset';
    mockPathname.mockReturnValue('/dashboard');
    vi.stubGlobal('location', {
      pathname: '/dashboard',
      reload: mockReloadBrowserPage,
    });
    const { Client_GTProvider } = await import('../client-boundary');
    const container = document.createElement('div');
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <Client_GTProvider dictionaries={{}} locale='en' translations={{}}>
          content
        </Client_GTProvider>
      );
    });

    const isLocaleRoutingEnabled =
      mockGTProvider.mock.calls.at(-1)?.[0]._localeRouting.isEnabled;
    expect(isLocaleRoutingEnabled()).toBe(false);

    expect(mockGTProvider.mock.calls.at(-1)?.[0]._resetLocaleCookieName).toBe(
      'custom-reset'
    );
    document.cookie = 'custom-routing-enabled=false;path=/';
    expect(isLocaleRoutingEnabled()).toBe(false);

    document.cookie = 'custom-routing-enabled=true;path=/';
    expect(isLocaleRoutingEnabled()).toBe(true);

    await act(async () => root.unmount());
  });

  it('checks the live pathname before returning the routing cookie name', async () => {
    process.env._GENERALTRANSLATION_PATH_REGEX =
      '^/(?!api(?:/|$)|_next(?:/|$)).*';
    mockPathname.mockReturnValue('/dashboard');
    vi.stubGlobal('location', {
      pathname: '/dashboard',
      reload: mockReloadBrowserPage,
    });
    const { Client_GTProvider } = await import('../client-boundary');
    const container = document.createElement('div');
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <Client_GTProvider dictionaries={{}} locale='en' translations={{}}>
          content
        </Client_GTProvider>
      );
    });

    const isLocaleRoutingEnabled =
      mockGTProvider.mock.calls.at(-1)?.[0]._localeRouting.isEnabled;
    expect(isLocaleRoutingEnabled()).toBe(true);

    vi.stubGlobal('location', {
      pathname: '/api/health',
      reload: mockReloadBrowserPage,
    });
    expect(isLocaleRoutingEnabled()).toBe(false);

    vi.stubGlobal('location', {
      pathname: '/_next/static/chunk.js',
      reload: mockReloadBrowserPage,
    });
    expect(isLocaleRoutingEnabled()).toBe(false);

    await act(async () => root.unmount());
  });

  it('keeps the routing cookie callback stable across rerenders', async () => {
    process.env._GENERALTRANSLATION_PATH_REGEX = '.*';
    mockPathname.mockReturnValue('/dashboard');
    vi.stubGlobal('location', {
      pathname: '/dashboard',
      reload: mockReloadBrowserPage,
    });
    const { Client_GTProvider } = await import('../client-boundary');
    const container = document.createElement('div');
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <Client_GTProvider dictionaries={{}} locale='en' translations={{}}>
          first
        </Client_GTProvider>
      );
    });
    const firstCallback =
      mockGTProvider.mock.calls.at(-1)?.[0]._localeRouting.isEnabled;

    await act(async () => {
      root.render(
        <Client_GTProvider dictionaries={{}} locale='en' translations={{}}>
          second
        </Client_GTProvider>
      );
    });
    const secondCallback =
      mockGTProvider.mock.calls.at(-1)?.[0]._localeRouting.isEnabled;

    expect(secondCallback).toBe(firstCallback);

    await act(async () => root.unmount());
  });

  it.each([
    ['/docs/routed/page', '^/routed(?:/|$)', true],
    ['/docs/excluded/page', '^/routed(?:/|$)', false],
    ['/docs-copy/routed/page', '^/docs-copy/', true],
    ['/docs/docs/routed/page', '^/docs/routed/', true],
    ['/docs', '^/$', true],
    ['/docs/', '^/$', true],
  ])(
    'checks the app-relative pathname with basePath: %s',
    async (pathname, pathRegex, routed) => {
      process.env._GENERALTRANSLATION_BASE_PATH = '/docs';
      process.env._GENERALTRANSLATION_PATH_REGEX = pathRegex;
      mockPathname.mockReturnValue('/routed/page');
      vi.stubGlobal('location', {
        pathname,
        reload: mockReloadBrowserPage,
      });
      const { Client_GTProvider } = await import('../client-boundary');
      const root = createRoot(document.createElement('div'));

      await act(async () => {
        root.render(
          <Client_GTProvider dictionaries={{}} locale='en' translations={{}}>
            content
          </Client_GTProvider>
        );
      });

      expect(
        mockGTProvider.mock.calls.at(-1)?.[0]._localeRouting.isEnabled()
      ).toBe(routed);

      await act(async () => root.unmount());
    }
  );

  it('recognizes a prefixed locale below basePath when switching to the default', async () => {
    process.env._GENERALTRANSLATION_BASE_PATH = '/docs';
    process.env._GENERALTRANSLATION_PATH_REGEX = '^/(?:fr/)?routed/';
    mockPathname.mockReturnValue('/fr/routed/page');
    vi.stubGlobal('location', {
      pathname: '/docs/fr/routed/page',
      reload: mockReloadBrowserPage,
    });
    mockGetI18nConfig.mockReturnValue({
      determineLocale: ([locale]: string[]) =>
        ['en', 'fr'].includes(locale) ? locale : undefined,
      getDefaultLocale: () => 'en',
      getLocales: () => ['en', 'fr'],
      isGTServicesEnabled: () => false,
      resolveAliasLocale: (locale: string) => locale,
      standardizeLocale: (locale: string) => locale,
    });
    const { Client_GTProvider } = await import('../client-boundary');
    const root = createRoot(document.createElement('div'));
    await act(async () => {
      root.render(
        <Client_GTProvider dictionaries={{}} locale='fr' translations={{}}>
          content
        </Client_GTProvider>
      );
    });

    mockGTProvider.mock.calls.at(-1)?.[0]._reload({ locale: 'en' });
    expect(mockReloadBrowserPage).toHaveBeenCalledOnce();
    expect(mockRefreshServerComponents).not.toHaveBeenCalled();

    await act(async () => root.unmount());
  });

  it('does not refresh excluded paths when the routing cookie is stale', async () => {
    const { Client_GTProvider } = await import('../client-boundary');
    const container = document.createElement('div');
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <Client_GTProvider dictionaries={{}} locale='en-GB' translations={{}}>
          content
        </Client_GTProvider>
      );
    });

    expect(mockGetI18nConfig).toHaveBeenCalled();
    expect(mockRefreshServerComponents).not.toHaveBeenCalled();
    expect(
      mockGTProvider.mock.calls.at(-1)?.[0]._localeRouting.isEnabled()
    ).toBe(false);

    await act(async () => root.unmount());
  });

  it('reloads the browser page when switching to the default locale', async () => {
    process.env._GENERALTRANSLATION_PATH_REGEX = '.*';
    mockPathname.mockReturnValue('/pt-BR');
    vi.stubGlobal('location', {
      pathname: '/pt-BR',
      reload: mockReloadBrowserPage,
    });
    mockGetI18nConfig.mockReturnValue({
      determineLocale: vi.fn(([locale]: string[]) => locale),
      getDefaultLocale: () => 'en',
      getLocales: () => ['en', 'pt-BR'],
      isGTServicesEnabled: () => false,
      resolveAliasLocale: (locale: string) => locale,
      standardizeLocale: (locale: string) => locale,
    });
    const { Client_GTProvider } = await import('../client-boundary');
    const container = document.createElement('div');
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <Client_GTProvider dictionaries={{}} locale='pt-BR' translations={{}}>
          content
        </Client_GTProvider>
      );
    });

    const syncServerContent = mockGTProvider.mock.calls.at(-1)?.[0]._reload;
    const requestedState = {
      enableI18n: true,
      locale: 'en',
      region: undefined,
    };
    syncServerContent(requestedState);

    expect(mockReloadBrowserPage).toHaveBeenCalledOnce();
    expect(mockRefreshServerComponents).not.toHaveBeenCalled();
    expect(
      mockGTProvider.mock.calls.at(-1)?.[0]._localeRouting.isEnabled()
    ).toBe(true);

    await act(async () => root.unmount());
  });

  it('refreshes server components when reselecting the default locale on an unprefixed path', async () => {
    process.env._GENERALTRANSLATION_PATH_REGEX = '.*';
    mockPathname.mockReturnValue('/dashboard');
    vi.stubGlobal('location', {
      pathname: '/dashboard',
      reload: mockReloadBrowserPage,
    });
    mockGetI18nConfig.mockReturnValue({
      determineLocale: vi.fn((locales: string[]) =>
        locales.find((locale) => ['en', 'fr'].includes(locale))
      ),
      getDefaultLocale: () => 'en',
      getLocales: () => ['en', 'fr'],
      isGTServicesEnabled: () => false,
      resolveAliasLocale: (locale: string) => locale,
      standardizeLocale: (locale: string) => locale,
    });
    const { Client_GTProvider } = await import('../client-boundary');
    const container = document.createElement('div');
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <Client_GTProvider dictionaries={{}} locale='en' translations={{}}>
          content
        </Client_GTProvider>
      );
    });

    const syncServerContent = mockGTProvider.mock.calls.at(-1)?.[0]._reload;
    syncServerContent({ enableI18n: true, locale: 'en', region: undefined });

    expect(mockRefreshServerComponents).toHaveBeenCalledOnce();
    expect(mockReloadBrowserPage).not.toHaveBeenCalled();

    await act(async () => root.unmount());
  });

  it('refreshes when an explicit locale prefix aliases the default locale', async () => {
    process.env._GENERALTRANSLATION_PATH_REGEX = '.*';
    mockPathname.mockReturnValue('/en-US/dashboard');
    vi.stubGlobal('location', {
      pathname: '/en-US/dashboard',
      reload: mockReloadBrowserPage,
    });
    mockGetI18nConfig.mockReturnValue({
      determineLocale: vi.fn(([locale]: string[]) => locale),
      getDefaultLocale: () => 'en',
      getLocales: () => ['en', 'fr'],
      isGTServicesEnabled: () => false,
      resolveAliasLocale: (locale: string) =>
        locale === 'en-US' ? 'en' : locale,
      standardizeLocale: (locale: string) => locale,
    });
    const { Client_GTProvider } = await import('../client-boundary');
    const container = document.createElement('div');
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <Client_GTProvider dictionaries={{}} locale='en' translations={{}}>
          content
        </Client_GTProvider>
      );
    });

    const syncServerContent = mockGTProvider.mock.calls.at(-1)?.[0]._reload;
    syncServerContent({ enableI18n: true, locale: 'en', region: undefined });

    expect(mockRefreshServerComponents).toHaveBeenCalledOnce();
    expect(mockReloadBrowserPage).not.toHaveBeenCalled();

    await act(async () => root.unmount());
  });

  it('refreshes server components on excluded paths', async () => {
    process.env._GENERALTRANSLATION_PATH_REGEX =
      '^/(?!fr/favicon\\.ico(?:/|$)).*';
    mockPathname.mockReturnValue('/fr/favicon.ico');
    vi.stubGlobal('location', {
      pathname: '/fr/favicon.ico',
      reload: mockReloadBrowserPage,
    });
    mockGetI18nConfig.mockReturnValue({
      determineLocale: vi.fn(),
      getDefaultLocale: () => 'en',
      getLocales: () => ['en', 'fr'],
      isGTServicesEnabled: () => false,
      resolveAliasLocale: (locale: string) => locale,
      standardizeLocale: (locale: string) => locale,
    });
    const { Client_GTProvider } = await import('../client-boundary');
    const container = document.createElement('div');
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <Client_GTProvider dictionaries={{}} locale='fr' translations={{}}>
          content
        </Client_GTProvider>
      );
    });

    const syncServerContent = mockGTProvider.mock.calls.at(-1)?.[0]._reload;
    syncServerContent({ enableI18n: true, locale: 'en', region: undefined });

    expect(mockRefreshServerComponents).toHaveBeenCalledOnce();
    expect(mockReloadBrowserPage).not.toHaveBeenCalled();

    await act(async () => root.unmount());
  });

  it('refreshes server components without locale routing', async () => {
    document.cookie =
      'generaltranslation.locale-routing-enabled=;max-age=0;path=/';
    const { Client_GTProvider } = await import('../client-boundary');
    const container = document.createElement('div');
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <Client_GTProvider dictionaries={{}} locale='fr' translations={{}}>
          content
        </Client_GTProvider>
      );
    });

    const syncServerContent = mockGTProvider.mock.calls.at(-1)?.[0]._reload;
    syncServerContent({ enableI18n: true, locale: 'en', region: undefined });

    expect(mockRefreshServerComponents).toHaveBeenCalledOnce();
    expect(mockReloadBrowserPage).not.toHaveBeenCalled();

    await act(async () => root.unmount());
  });
});
