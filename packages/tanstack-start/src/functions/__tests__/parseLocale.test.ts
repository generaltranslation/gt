import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mockSetCookie = vi.hoisted(() => vi.fn());

vi.mock('@tanstack/react-start/server', () => ({
  setCookie: (...args: unknown[]) => mockSetCookie(...args),
}));

import { initializeI18nConfig } from '@generaltranslation/react-core/pure';
import { getLocaleFromPath } from '../localeRouting';
import { determineLocaleClient } from '../parseLocale';
import { resolveRequestConditions } from '../requestConditions';

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
  locales: ['en', 'es', 'brand-french'],
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

describe.sequential('locale resolution', () => {
  beforeEach(() => {
    resetI18nConfigSingleton();
    initializeI18nConfig(localeConfig);
    mockSetCookie.mockReset();
  });

  afterEach(() => {
    restoreGlobalProperty('document', originalDocumentDescriptor);
    vi.unstubAllGlobals();
  });

  it('uses the server cookie before Accept-Language', () => {
    const request = createRequest({
      cookie: 'generaltranslation.locale=brand-french',
      acceptLanguage: 'es,en;q=0.8',
    });

    expect(resolveRequestConditions(request, localeConfig).locale).toBe(
      'brand-french'
    );
    expect(mockSetCookie).toHaveBeenCalledWith(
      'generaltranslation.locale',
      'brand-french',
      {
        path: '/',
        sameSite: 'lax',
        maxAge: 60 * 60 * 24 * 365,
      }
    );
  });

  it('falls back to the server Accept-Language header', () => {
    const request = createRequest({ acceptLanguage: 'es,en;q=0.8' });

    expect(resolveRequestConditions(request, localeConfig).locale).toBe('es');
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

  it('reads and writes a custom locale cookie name on the server', () => {
    resetI18nConfigSingleton();
    initializeI18nConfig({
      ...localeConfig,
      localeCookieName: 'custom-locale',
    });
    const request = createRequest({
      cookie: 'custom-locale=fr',
      acceptLanguage: 'es,en;q=0.8',
    });

    expect(resolveRequestConditions(request, localeConfig).locale).toBe(
      'brand-french'
    );
    expect(mockSetCookie).toHaveBeenCalledWith(
      'custom-locale',
      'brand-french',
      {
        path: '/',
        sameSite: 'lax',
        maxAge: 60 * 60 * 24 * 365,
      }
    );
  });

  it('resolves the default locale cookie during client initialization', () => {
    Object.defineProperty(globalThis, 'document', {
      configurable: true,
      value: {
        cookie: 'generaltranslation.locale=brand-french',
      },
    });

    expect(determineLocaleClient(localeConfig)).toBe('brand-french');
  });

  it('resolves a custom locale cookie during client initialization', () => {
    resetI18nConfigSingleton();
    initializeI18nConfig({
      ...localeConfig,
      localeCookieName: 'custom-locale',
    });
    Object.defineProperty(globalThis, 'document', {
      configurable: true,
      value: {
        cookie: 'generaltranslation.locale=es; custom-locale=fr',
      },
    });

    expect(determineLocaleClient(localeConfig)).toBe('brand-french');
  });

  it('falls back to the browser languages without a cookie', () => {
    // A static SPA has no server to set the cookie on a first visit.
    Object.defineProperty(globalThis, 'document', {
      configurable: true,
      value: { cookie: '' },
    });
    vi.stubGlobal('navigator', { languages: ['de', 'es'] });

    expect(determineLocaleClient(localeConfig)).toBe('es');
  });

  it('prefers the cookie over the browser languages', () => {
    Object.defineProperty(globalThis, 'document', {
      configurable: true,
      value: { cookie: 'generaltranslation.locale=es' },
    });
    vi.stubGlobal('navigator', { languages: ['fr'] });

    expect(determineLocaleClient(localeConfig)).toBe('es');
  });

  it('falls back to the default locale during client initialization', () => {
    Object.defineProperty(globalThis, 'document', {
      configurable: true,
      value: { cookie: '' },
    });
    vi.stubGlobal('navigator', { languages: [] });

    expect(determineLocaleClient(localeConfig)).toBe('en');
  });

  it('prefers the pathname locale during client initialization with locale routing', () => {
    Object.defineProperty(globalThis, 'document', {
      configurable: true,
      value: { cookie: 'generaltranslation.locale=es' },
    });
    expect(
      determineLocaleClient(localeConfig, getLocaleFromPath('/fr/about'))
    ).toBe('brand-french');
    expect(determineLocaleClient(localeConfig)).toBe('es');
  });

  it('falls back to the cookie without a pathname locale', () => {
    Object.defineProperty(globalThis, 'document', {
      configurable: true,
      value: { cookie: 'generaltranslation.locale=es' },
    });
    expect(
      determineLocaleClient(localeConfig, getLocaleFromPath('/about'))
    ).toBe('es');
  });
});
