import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  mockCreateOrUpdateBrowserConditionStore,
  mockDetermineLocaleClient,
  mockGetPathnameForLocale,
  mockInitializeReactGT,
} = vi.hoisted(() => ({
  mockCreateOrUpdateBrowserConditionStore: vi.fn(),
  mockDetermineLocaleClient: vi.fn(() => 'fr'),
  mockGetPathnameForLocale: vi.fn(() => '/fr/about'),
  mockInitializeReactGT: vi.fn(),
}));

vi.mock('gt-react', () => ({
  createOrUpdateBrowserConditionStore: mockCreateOrUpdateBrowserConditionStore,
  initializeGT: mockInitializeReactGT,
}));

vi.mock('../../functions/parseLocale', () => ({
  determineLocaleClient: mockDetermineLocaleClient,
}));

vi.mock('../../functions/localeRouting', () => ({
  getPathnameForLocale: mockGetPathnameForLocale,
}));

import { initializeGT } from '../initializeGT.client';

describe('initializeGT client', () => {
  beforeEach(() => {
    mockCreateOrUpdateBrowserConditionStore.mockReset();
    mockDetermineLocaleClient.mockClear();
    mockGetPathnameForLocale.mockClear();
    mockInitializeReactGT.mockReset();
    vi.unstubAllGlobals();
  });

  it('reloads through the locale pathname when locale routing is enabled', () => {
    const assign = vi.fn();
    vi.stubGlobal('window', {
      location: {
        href: 'https://example.com/ar/about?view=full#bio',
        pathname: '/ar/about',
        search: '?view=full',
        hash: '#bio',
        assign,
      },
    });
    const config = {
      defaultLocale: 'en',
      locales: ['en', 'fr', 'ar'],
      localeRouting: true,
    };

    initializeGT(config);

    const browserConfig =
      mockCreateOrUpdateBrowserConditionStore.mock.calls[0][0];
    browserConfig._reload({ locale: 'fr' });
    expect(mockGetPathnameForLocale).toHaveBeenCalledWith('/ar/about', 'fr');
    expect(assign).toHaveBeenCalledWith(
      'https://example.com/fr/about?view=full#bio'
    );
  });

  it('keeps protocol-relative pathnames on the current origin', () => {
    const assign = vi.fn();
    vi.stubGlobal('window', {
      location: {
        href: 'https://example.com/fr//evil.example?view=full#bio',
        pathname: '/fr//evil.example',
        search: '?view=full',
        hash: '#bio',
        assign,
      },
    });
    mockGetPathnameForLocale.mockReturnValueOnce('//evil.example');

    initializeGT({
      defaultLocale: 'en',
      locales: ['en', 'fr'],
      localeRouting: true,
    });

    const browserConfig =
      mockCreateOrUpdateBrowserConditionStore.mock.calls[0][0];
    browserConfig._reload({ locale: 'en' });
    expect(assign).toHaveBeenCalledWith(
      'https://example.com//evil.example?view=full#bio'
    );
  });

  it('preserves a custom reload when locale routing is enabled', () => {
    const customReload = vi.fn();
    const config = {
      defaultLocale: 'en',
      locales: ['en', 'fr'],
      localeRouting: true,
      _reload: customReload,
    };

    initializeGT(config);

    const browserConfig =
      mockCreateOrUpdateBrowserConditionStore.mock.calls.at(-1)![0];
    expect(browserConfig._reload).toBe(customReload);
  });

  it('initializes React with the cookie locale', () => {
    const config = {
      defaultLocale: 'en',
      locales: ['en', 'fr'],
    };

    initializeGT(config);

    expect(mockInitializeReactGT).toHaveBeenCalledWith(config);
    expect(mockDetermineLocaleClient).toHaveBeenCalledWith(config);
    expect(mockCreateOrUpdateBrowserConditionStore).toHaveBeenCalledWith({
      ...config,
      locale: 'fr',
    });
    expect(mockInitializeReactGT.mock.invocationCallOrder[0]).toBeLessThan(
      mockDetermineLocaleClient.mock.invocationCallOrder[0]
    );
  });
});
