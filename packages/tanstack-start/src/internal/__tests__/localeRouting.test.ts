import { afterEach, describe, expect, it, vi } from 'vitest';

const { mockGetPathnameForLocale } = vi.hoisted(() => ({
  mockGetPathnameForLocale: vi.fn(() => '/fr/about'),
}));

vi.mock('../../functions/localeRouting', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../functions/localeRouting')>()),
  getPathnameForLocale: mockGetPathnameForLocale,
}));

import { initializeI18nConfig } from '@generaltranslation/react-core/pure';
import * as disabled from '../localeRouting.disabled';
import * as enabled from '../localeRouting.enabled';
import type { GTRouterOptions } from '../../router/types';

function stubLocation(href: string) {
  const assign = vi.fn();
  const { pathname, search, hash } = new URL(href);
  vi.stubGlobal('window', {
    location: { href, pathname, search, hash, assign },
  });
  return assign;
}

function createRouter(options: GTRouterOptions = {}) {
  return {
    options,
    update: vi.fn<(options: Partial<GTRouterOptions>) => void>(),
    history: { location: { state: { key: 'entry' } }, replace: vi.fn() },
  };
}

describe.sequential('browser locale routing', () => {
  afterEach(() => {
    mockGetPathnameForLocale.mockClear();
    vi.unstubAllGlobals();
  });

  it('switches locale by navigating to its pathname', () => {
    const assign = stubLocation('https://example.com/ar/about?view=full#bio');

    enabled.createLocaleReload()?.({ locale: 'fr' } as never);

    expect(mockGetPathnameForLocale).toHaveBeenCalledWith('/ar/about', 'fr');
    expect(assign).toHaveBeenCalledWith(
      'https://example.com/fr/about?view=full#bio'
    );
  });

  it('keeps protocol-relative pathnames on the current origin', () => {
    const assign = stubLocation(
      'https://example.com/fr//evil.example?view=full#bio'
    );
    mockGetPathnameForLocale.mockReturnValueOnce('//evil.example');

    enabled.createLocaleReload()?.({ locale: 'en' } as never);

    expect(assign).toHaveBeenCalledWith(
      'https://example.com//evil.example?view=full#bio'
    );
  });

  it("moves the visitor onto their locale's URL", () => {
    stubLocation('https://example.com/about?view=full#bio');
    const rewrite = { input: vi.fn(), output: vi.fn() };
    const router = createRouter({ rewrite });

    enabled.replaceWithLocaleURL(router, 'fr');

    expect(mockGetPathnameForLocale).toHaveBeenCalledWith('/about', 'fr');
    expect(router.history.replace).toHaveBeenCalledWith(
      '/fr/about?view=full#bio',
      { key: 'entry' }
    );
    // A new rewrite object makes Router parse and store the replaced URL.
    const [[{ rewrite: updated }]] = router.update.mock.calls;
    expect(updated).toEqual(rewrite);
    expect(updated).not.toBe(rewrite);
  });

  it("leaves the URL alone when it is already the locale's", () => {
    stubLocation('https://example.com/fr/about');
    const router = createRouter();

    enabled.replaceWithLocaleURL(router, 'fr');

    expect(router.history.replace).not.toHaveBeenCalled();
  });

  it('leaves the URL alone rather than replace it with a protocol-relative path', () => {
    stubLocation('https://example.com/en//evil.example');
    mockGetPathnameForLocale.mockReturnValueOnce('//evil.example');
    const router = createRouter();

    enabled.replaceWithLocaleURL(router, 'en');

    expect(router.history.replace).not.toHaveBeenCalled();
  });

  it('reads the locale from the current pathname', () => {
    Reflect.deleteProperty(globalThis, '__generaltranslation');
    initializeI18nConfig({ defaultLocale: 'en', locales: ['en', 'fr'] });
    stubLocation('https://example.com/fr/about');

    expect(enabled.getPathLocale()).toBe('fr');
  });

  it('does nothing when locale routing is off', () => {
    const router = createRouter();

    expect(disabled.getRouterLocaleRewrite(router, () => 'fr')).toBeUndefined();
    expect(disabled.getPathLocale()).toBeUndefined();
    disabled.replaceWithLocaleURL(router, 'fr');
    expect(router.history.replace).not.toHaveBeenCalled();
    expect(disabled.createLocaleReload()).toBeUndefined();
  });
});
