import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mockRequest = vi.hoisted(() => vi.fn());
const mockSetCookie = vi.hoisted(() => vi.fn());
const mockGetLocale = vi.hoisted(() => vi.fn(() => 'fr'));

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
  getRequest: () => mockRequest(),
  setCookie: (...args: unknown[]) => mockSetCookie(...args),
}));

vi.mock('../runtime', () => ({
  getLocale: mockGetLocale,
}));

import { initializeI18nConfig } from '@generaltranslation/react-core/pure';
import { AsyncLocalConditionStore } from '../../condition-store/AsyncLocalConditionStore';
import { setConditionStore } from '../../condition-store/singleton';
import { determineLocale, determineLocaleClient } from '../parseLocale';

type GlobalWithRegistry = {
  __generaltranslation?: {
    i18n?: Record<string, unknown>;
    tanstackStart?: Record<string, unknown>;
  };
};

function resetI18nConfigSingleton() {
  const globalObj = globalThis as GlobalWithRegistry;
  if (globalObj.__generaltranslation?.i18n) {
    Reflect.deleteProperty(globalObj.__generaltranslation.i18n, 'i18nConfig');
  }
  if (globalObj.__generaltranslation?.tanstackStart) {
    Reflect.deleteProperty(
      globalObj.__generaltranslation.tanstackStart,
      'conditionStore'
    );
  }
}

function createRequest({
  cookie,
  acceptLanguage,
}: {
  cookie?: string;
  acceptLanguage?: string;
}) {
  const headers = new Headers();
  if (cookie) headers.set('cookie', cookie);
  if (acceptLanguage) headers.set('accept-language', acceptLanguage);
  return new Request('https://example.com', { headers });
}

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

function restoreGlobalProperty(
  property: 'document',
  descriptor: PropertyDescriptor | undefined
) {
  if (descriptor) {
    Object.defineProperty(globalThis, property, descriptor);
    return;
  }

  Reflect.deleteProperty(globalThis, property);
}

describe.sequential('parseLocale', () => {
  beforeEach(() => {
    resetI18nConfigSingleton();
    initializeI18nConfig(localeConfig);
    mockGetLocale.mockClear();
    mockRequest.mockReset();
    mockSetCookie.mockReset();
  });

  afterEach(() => {
    restoreGlobalProperty('document', originalDocumentDescriptor);
  });

  it('uses the server cookie before Accept-Language', () => {
    mockRequest.mockReturnValue(
      createRequest({
        cookie: 'generaltranslation.locale=brand-french',
        acceptLanguage: 'es,en;q=0.8',
      })
    );

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
    mockRequest.mockReturnValue(
      createRequest({ acceptLanguage: 'es,en;q=0.8' })
    );

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

  it('reuses locale state initialized by request middleware', () => {
    const conditionStore = new AsyncLocalConditionStore(localeConfig);
    setConditionStore(conditionStore);

    const locale = conditionStore.run(
      createRequest({ cookie: 'generaltranslation.locale=fr' }),
      () => {
        mockRequest.mockClear();
        mockSetCookie.mockClear();
        return (
          determineLocale as unknown as {
            server: (config: typeof localeConfig) => string;
          }
        ).server(localeConfig);
      }
    );

    expect(locale).toBe('fr');
    expect(mockRequest).not.toHaveBeenCalled();
    expect(mockSetCookie).not.toHaveBeenCalled();
  });

  it('reads initialized locale state on the client', () => {
    expect(
      (
        determineLocale as unknown as {
          client: (config: typeof localeConfig) => string;
        }
      ).client(localeConfig)
    ).toBe('fr');
    expect(mockGetLocale).toHaveBeenCalledOnce();
  });

  it('reads and writes a custom locale cookie name on the server', () => {
    resetI18nConfigSingleton();
    initializeI18nConfig({
      ...localeConfig,
      localeCookieName: 'custom-locale',
    });
    mockRequest.mockReturnValue(
      createRequest({
        cookie: 'custom-locale=fr',
        acceptLanguage: 'es,en;q=0.8',
      })
    );

    expect(
      (
        determineLocale as unknown as {
          server: (config: typeof localeConfig) => string;
        }
      ).server(localeConfig)
    ).toBe('fr');
    expect(mockSetCookie).toHaveBeenCalledWith('custom-locale', 'fr', {
      path: '/',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 365,
    });
  });

  it('reads the default locale cookie during client initialization', () => {
    Object.defineProperty(globalThis, 'document', {
      configurable: true,
      value: {
        cookie: 'generaltranslation.locale=brand-french',
      },
    });

    expect(determineLocaleClient({})).toBe('brand-french');
  });

  it('reads a custom locale cookie during client initialization', () => {
    Object.defineProperty(globalThis, 'document', {
      configurable: true,
      value: {
        cookie: 'generaltranslation.locale=es; custom-locale=fr',
      },
    });

    expect(determineLocaleClient({ localeCookieName: 'custom-locale' })).toBe(
      'fr'
    );
  });

  it('leaves locale selection to gt-react without a cookie', () => {
    Object.defineProperty(globalThis, 'document', {
      configurable: true,
      value: { cookie: '' },
    });

    expect(determineLocaleClient({})).toBeUndefined();
  });
});
