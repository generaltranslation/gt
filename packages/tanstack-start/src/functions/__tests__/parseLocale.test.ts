import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockRequestHeader = vi.hoisted(() => vi.fn());
const mockCookie = vi.hoisted(() => vi.fn());

vi.mock('@tanstack/react-start/server', () => ({
  getCookie: (...args: unknown[]) => mockCookie(...args),
  getRequestHeader: (...args: unknown[]) => mockRequestHeader(...args),
}));

import { initializeI18nConfig } from 'gt-i18n/internal';
import { parseLocale } from '../parseLocale';

const localeConfig = {
  defaultLocale: 'en',
  locales: ['en', 'fr', 'es', 'brand-french'],
  customMapping: {
    'brand-french': {
      code: 'fr',
      name: 'Brand French',
    },
  },
};

describe('parseLocale', () => {
  beforeEach(() => {
    initializeI18nConfig(localeConfig);
    mockCookie.mockReset();
    mockRequestHeader.mockReset();
    delete process.env._GENERALTRANSLATION_IGNORE_BROWSER_LOCALES;
  });

  it('uses the server cookie before Accept-Language', () => {
    mockCookie.mockReturnValue('brand-french');
    mockRequestHeader.mockReturnValue('es,en;q=0.8');

    expect(parseLocale()).toBe('fr');
  });

  it('falls back to the server Accept-Language header', () => {
    mockCookie.mockReturnValue(undefined);
    mockRequestHeader.mockReturnValue('es,en;q=0.8');

    expect(parseLocale()).toBe('es');
  });

  it('always checks Accept-Language', () => {
    process.env._GENERALTRANSLATION_IGNORE_BROWSER_LOCALES = 'true';
    mockCookie.mockReturnValue(undefined);
    mockRequestHeader.mockReturnValue('es,en;q=0.8');

    expect(parseLocale()).toBe('es');
  });

  it('falls back to the default locale', () => {
    mockCookie.mockReturnValue(undefined);
    mockRequestHeader.mockReturnValue(undefined);

    expect(parseLocale()).toBe('en');
  });
});
