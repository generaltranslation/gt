import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mockRequestHeader = vi.hoisted(() => vi.fn());
const mockCookie = vi.hoisted(() => vi.fn());
const mockSetCookie = vi.hoisted(() => vi.fn());

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
  setCookie: (...args: unknown[]) => mockSetCookie(...args),
}));

import { initializeI18nConfig } from 'gt-i18n/internal';
import { determineLocale } from '../parseLocale';

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

const originalDocumentDescriptor = Object.getOwnPropertyDescriptor(
  globalThis,
  'document'
);
const originalNavigatorDescriptor = Object.getOwnPropertyDescriptor(
  globalThis,
  'navigator'
);

function restoreGlobalProperty(
  property: 'document' | 'navigator',
  descriptor: PropertyDescriptor | undefined
) {
  if (descriptor) {
    Object.defineProperty(globalThis, property, descriptor);
    return;
  }

  Reflect.deleteProperty(globalThis, property);
}

describe('parseLocale', () => {
  beforeEach(() => {
    initializeI18nConfig(localeConfig);
    mockCookie.mockReset();
    mockRequestHeader.mockReset();
    mockSetCookie.mockReset();
  });

  afterEach(() => {
    restoreGlobalProperty('document', originalDocumentDescriptor);
    restoreGlobalProperty('navigator', originalNavigatorDescriptor);
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
    expect(mockSetCookie).toHaveBeenCalledWith(
      'generaltranslation.locale',
      'fr',
      {
        path: '/',
        sameSite: 'lax',
        maxAge: 60 * 60 * 24 * 365,
      }
    );
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
    expect(mockSetCookie).toHaveBeenCalledWith(
      'generaltranslation.locale',
      'es',
      {
        path: '/',
        sameSite: 'lax',
        maxAge: 60 * 60 * 24 * 365,
      }
    );
  });

  it('uses client cookies', () => {
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

  it('falls back to the default locale on the client without a cookie', () => {
    Object.defineProperty(globalThis, 'document', {
      configurable: true,
      value: {
        cookie: '',
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
    ).toBe('en');
  });
});
