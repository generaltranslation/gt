import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { initializeI18nConfig } from 'gt-i18n/internal';
import {
  getAcceptLanguageCandidates,
  getLocaleHeaderCandidates,
  getLocaleResolutionParams,
  resolveLocaleFromCandidates,
} from '../resolveLocale';

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

let savedEnv: NodeJS.ProcessEnv;

type TestGlobal = typeof globalThis & {
  __generaltranslation?: {
    i18n?: {
      i18nConfig?: unknown;
      [key: string]: unknown;
    };
    [key: string]: unknown;
  };
};

function resetI18nConfigGlobal() {
  const globalObj = globalThis as TestGlobal;
  if (globalObj.__generaltranslation?.i18n) {
    Reflect.deleteProperty(globalObj.__generaltranslation.i18n, 'i18nConfig');
  }
}

describe('resolveLocale helpers', () => {
  beforeEach(() => {
    savedEnv = { ...process.env };
    delete process.env._GENERALTRANSLATION_I18N_CONFIG_PARAMS;
    resetI18nConfigGlobal();
    initializeI18nConfig(localeConfig);
  });

  afterEach(() => {
    process.env = savedEnv;
    vi.restoreAllMocks();
  });

  it('reads locale resolution params with defaults', () => {
    expect(getLocaleResolutionParams()).toEqual({
      headerName: 'x-generaltranslation-locale',
      cookieName: 'generaltranslation.locale',
      ignorePreferredLanguages: false,
    });
  });

  it('reads configured locale resolution params', () => {
    process.env._GENERALTRANSLATION_I18N_CONFIG_PARAMS = JSON.stringify({
      headersAndCookies: {
        localeHeaderName: 'x-custom-locale',
        localeCookieName: 'custom-locale',
      },
      ignoreBrowserLocales: true,
    });

    expect(getLocaleResolutionParams()).toEqual({
      headerName: 'x-custom-locale',
      cookieName: 'custom-locale',
      ignorePreferredLanguages: true,
    });
  });

  it('extracts Accept-Language candidates from strings and arrays', () => {
    expect(
      getAcceptLanguageCandidates([
        'es-MX, fr;q=0.8',
        ' , en-US;q=0.6',
      ])
    ).toEqual(['es-MX', 'fr', 'en-US']);
  });

  it('extracts locale header candidates from strings and arrays', () => {
    expect(getLocaleHeaderCandidates(['', 'fr', 'es'])).toEqual(['fr', 'es']);
    expect(getLocaleHeaderCandidates('brand-french')).toEqual([
      'brand-french',
    ]);
  });

  it('resolves candidates against the i18n config', () => {
    expect(resolveLocaleFromCandidates(['brand-french'], false)).toBe('fr');
  });

  it('warns and falls back when no locale candidates are available', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    expect(resolveLocaleFromCandidates([], false)).toBe('en');
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining('No locale could be determined')
    );
  });
});
