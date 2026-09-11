// @vitest-environment jsdom
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
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
      getLocales: () => ['en', 'en-GB', 'fr'],
      isGTServicesEnabled: () => false,
      resolveAliasLocale: (locale: string) => locale,
      standardizeLocale: (locale: string) => locale,
    });
    globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  });

  afterEach(() => {
    delete process.env._GENERALTRANSLATION_PATH_REGEX;
    document.cookie =
      'generaltranslation.locale-routing-enabled=;max-age=0;path=/';
    vi.unstubAllGlobals();
    globalThis.IS_REACT_ACT_ENVIRONMENT = false;
  });

  it.each([false, true])(
    'does not reload equivalent default spellings after remounts (GT services: %s)',
    async (gtServicesEnabled) => {
      process.env._GENERALTRANSLATION_PATH_REGEX = '.*';
      mockPathname.mockReturnValue('/pricing');
      const { I18nConfig } = await import('gt-i18n/internal');
      const config = new I18nConfig({
        defaultLocale: 'en-us',
        locales: gtServicesEnabled ? ['en-US', 'fr'] : ['en-us', 'fr'],
        projectId: gtServicesEnabled ? 'locale-comparison-test' : undefined,
        runtimeUrl: gtServicesEnabled ? undefined : null,
        cacheUrl: gtServicesEnabled ? undefined : null,
      });
      expect(config.isGTServicesEnabled()).toBe(gtServicesEnabled);
      mockGetI18nConfig.mockReturnValue(config);
      const { Client_GTProvider } = await import('../client-boundary');

      for (let mount = 0; mount < 3; mount++) {
        // Middleware restores this cookie on every document request.
        document.cookie =
          'generaltranslation.locale-routing-enabled=true;path=/';
        const root = createRoot(document.createElement('div'));
        try {
          await act(async () => {
            root.render(
              <Client_GTProvider
                dictionaries={{}}
                locale='en-US'
                translations={{}}
              >
                content
              </Client_GTProvider>
            );
          });
        } finally {
          await act(async () => root.unmount());
        }
      }

      expect(mockReloadBrowserPage).not.toHaveBeenCalled();
      expect(mockRefreshServerComponents).not.toHaveBeenCalled();
      expect(document.cookie).toContain(
        'generaltranslation.locale-routing-enabled=true'
      );
    }
  );

  it('still reloads when the path and provider have different supported regional locales', async () => {
    process.env._GENERALTRANSLATION_PATH_REGEX = '.*';
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
    const { Client_GTProvider } = await import('../client-boundary');
    const root = createRoot(document.createElement('div'));
    try {
      await act(async () => {
        root.render(
          <Client_GTProvider dictionaries={{}} locale='en-GB' translations={{}}>
            content
          </Client_GTProvider>
        );
      });
      expect(mockReloadBrowserPage).toHaveBeenCalledOnce();
      expect(mockRefreshServerComponents).not.toHaveBeenCalled();
    } finally {
      await act(async () => root.unmount());
    }
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
    syncServerContent({ enableI18n: true, locale: 'en', region: undefined });

    expect(mockReloadBrowserPage).toHaveBeenCalledOnce();
    expect(mockRefreshServerComponents).not.toHaveBeenCalled();

    await act(async () => root.unmount());
  });

  it('reloads the browser when reselecting the default locale on an unprefixed path', async () => {
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

    expect(mockReloadBrowserPage).toHaveBeenCalledOnce();
    expect(mockRefreshServerComponents).not.toHaveBeenCalled();

    await act(async () => root.unmount());
  });

  it('reloads when an explicit locale prefix aliases the default locale', async () => {
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

    expect(mockReloadBrowserPage).toHaveBeenCalledOnce();
    expect(mockRefreshServerComponents).not.toHaveBeenCalled();

    await act(async () => root.unmount());
  });

  it('reloads the browser on excluded paths', async () => {
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

    expect(mockReloadBrowserPage).toHaveBeenCalledOnce();
    expect(mockRefreshServerComponents).not.toHaveBeenCalled();

    await act(async () => root.unmount());
  });

  it('reloads the browser without locale routing', async () => {
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

    expect(mockReloadBrowserPage).toHaveBeenCalledOnce();
    expect(mockRefreshServerComponents).not.toHaveBeenCalled();

    await act(async () => root.unmount());
  });
});
