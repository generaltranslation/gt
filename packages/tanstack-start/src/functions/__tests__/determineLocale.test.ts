import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockRequestHeader = vi.hoisted(() => vi.fn());
const mockCookie = vi.hoisted(() => vi.fn());

vi.mock('@tanstack/react-start', () => ({
  createIsomorphicFn: () => ({
    server: (serverFn: unknown) => ({
      client: (clientFn: unknown) => ({
        client: clientFn,
        server: serverFn,
      }),
    }),
  }),
}));

vi.mock('@tanstack/react-start/server', () => ({
  getCookie: (...args: unknown[]) => mockCookie(...args),
  getRequestHeader: (...args: unknown[]) => mockRequestHeader(...args),
}));

import { determineLocale } from '../determineLocale';

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

describe('determineLocale', () => {
  beforeEach(() => {
    mockCookie.mockReset();
    mockRequestHeader.mockReset();
    process.env._GENERALTRANSLATION_IGNORE_BROWSER_LOCALES = 'false';
  });

  it('uses the server cookie before Accept-Language', () => {
    mockCookie.mockReturnValue('brand-french');
    mockRequestHeader.mockReturnValue('es,en;q=0.8');

    expect(
      (
        determineLocale as unknown as {
          server: (config: typeof localeConfig) => string;
        }
      ).server(localeConfig)
    ).toBe('fr');
  });

  it('falls back to the server Accept-Language header', () => {
    mockCookie.mockReturnValue(undefined);
    mockRequestHeader.mockReturnValue('es,en;q=0.8');

    expect(
      (
        determineLocale as unknown as {
          server: (config: typeof localeConfig) => string;
        }
      ).server(localeConfig)
    ).toBe('es');
  });

  it('uses client cookies before navigator language', () => {
    Object.defineProperty(globalThis, 'document', {
      configurable: true,
      value: {
        cookie: 'generaltranslation.locale=brand-french',
      },
    });
    Object.defineProperty(globalThis, 'navigator', {
      configurable: true,
      value: {
        language: 'es',
      },
    });

    expect(
      (
        determineLocale as unknown as {
          client: (config: typeof localeConfig) => string;
        }
      ).client(localeConfig)
    ).toBe('fr');
  });
});
