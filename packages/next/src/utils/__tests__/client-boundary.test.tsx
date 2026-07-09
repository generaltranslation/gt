// @vitest-environment jsdom
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { mockGetI18nConfig, mockInitializeGTClient, mockRefresh } = vi.hoisted(
  () => ({
    mockGetI18nConfig: vi.fn(),
    mockInitializeGTClient: vi.fn(),
    mockRefresh: vi.fn(),
  })
);

vi.mock('gt-i18n/internal', () => ({
  getI18nConfig: mockGetI18nConfig,
}));

vi.mock('gt-react', () => ({
  GTProvider: ({ children }: { children?: React.ReactNode }) => children,
  LocaleSelector: () => null,
  RegionSelector: () => null,
}));

vi.mock('next/navigation', () => ({
  usePathname: () => '/uk',
  useRouter: () => ({ refresh: mockRefresh }),
}));

vi.mock('../../setup/initGT.client', () => ({
  initializeGTClient: mockInitializeGTClient,
}));

describe('Client_GTProvider', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
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
});
