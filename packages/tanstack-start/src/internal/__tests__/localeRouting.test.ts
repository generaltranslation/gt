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

function stubLocation(href: string) {
  const assign = vi.fn();
  const url = new URL(href);
  vi.stubGlobal('window', {
    location: { href, pathname: url.pathname, assign },
  });
  return assign;
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

  it('reads the locale from the current pathname', () => {
    Reflect.deleteProperty(globalThis, '__generaltranslation');
    initializeI18nConfig({ defaultLocale: 'en', locales: ['en', 'fr'] });
    stubLocation('https://example.com/fr/about');

    expect(enabled.getPathLocale()).toBe('fr');
  });

  it('does nothing when locale routing is off', () => {
    const router = { options: {}, update: vi.fn() };

    expect(disabled.getRouterLocaleRewrite(router, () => 'fr')).toBeUndefined();
    expect(disabled.getPathLocale()).toBeUndefined();
    expect(disabled.createLocaleReload()).toBeUndefined();
  });
});
