// @vitest-environment jsdom
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const {
  mockGetI18nConfig,
  mockGTProvider,
  mockInitializeGTClient,
  mockPathname,
  mockRefresh,
  mockReloadPage,
} = vi.hoisted(() => ({
  mockGetI18nConfig: vi.fn(),
  mockGTProvider: vi.fn(
    ({ children }: { children?: React.ReactNode }) => children
  ),
  mockInitializeGTClient: vi.fn(),
  mockPathname: vi.fn(),
  mockRefresh: vi.fn(),
  mockReloadPage: vi.fn(),
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
  useRouter: () => ({ refresh: mockRefresh }),
}));

vi.mock('../../setup/initGT.client', () => ({
  initializeGTClient: mockInitializeGTClient,
}));

describe('Client_GTProvider', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    vi.stubGlobal('location', { pathname: '/uk', reload: mockReloadPage });
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
    expect(mockRefresh).not.toHaveBeenCalled();

    await act(async () => root.unmount());
  });

  it('reloads the page when switching to the default locale', async () => {
    process.env._GENERALTRANSLATION_PATH_REGEX = '.*';
    mockPathname.mockReturnValue('/pt-BR');
    vi.stubGlobal('location', {
      pathname: '/pt-BR',
      reload: mockReloadPage,
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

    const reload = mockGTProvider.mock.calls.at(-1)?.[0]._reload;
    reload({ enableI18n: true, locale: 'en', region: undefined });

    expect(mockReloadPage).toHaveBeenCalledOnce();
    expect(mockRefresh).not.toHaveBeenCalled();

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

    const reload = mockGTProvider.mock.calls.at(-1)?.[0]._reload;
    reload({ enableI18n: true, locale: 'en', region: undefined });

    expect(mockRefresh).toHaveBeenCalledOnce();
    expect(mockReloadPage).not.toHaveBeenCalled();

    await act(async () => root.unmount());
  });
});
