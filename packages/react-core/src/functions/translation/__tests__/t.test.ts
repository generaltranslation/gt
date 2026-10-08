import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { hashSource } from 'generaltranslation/id';
import type { ReactI18nCache } from '../../../i18n-cache/ReactI18nCache';
import { setReactI18nCache } from '../../../i18n-cache/singleton-operations';
import { setReadonlyConditionStore } from '../../../condition-store/singleton-operations';
import { setGlobalTranslationsSnapshot } from '../../../translations-snapshot/singleton-operations';
import { initializeI18nConfig } from '../../../setup/i18nConfig';
import { t } from '../t';

type TestGlobal = typeof globalThis & {
  __generaltranslation?: unknown;
};

function resetGTGlobals() {
  Reflect.deleteProperty(globalThis as TestGlobal, '__generaltranslation');
}

const lookupTranslation = vi.fn();
let currentLocale = 'en';

function setup() {
  initializeI18nConfig(
    {
      defaultLocale: 'en',
      locales: ['en', 'fr', 'es'],
    },
    'SPA'
  );
  setReadonlyConditionStore({
    getLocale: () => currentLocale,
    getRegion: () => undefined,
    getEnableI18n: () => true,
    setLocale: () => {},
    setRegion: () => {},
    setEnableI18n: () => {},
  });
  setReactI18nCache({
    lookupTranslation,
  } as unknown as ReactI18nCache);
}

describe('t', () => {
  beforeEach(() => {
    resetGTGlobals();
    lookupTranslation.mockReset();
    currentLocale = 'en';
    setup();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('interpolates source strings when translation is not required', () => {
    expect(t('hello, {name}', { name: 'brian' })).toBe('hello, brian');
  });

  it('keeps tagged template literal lookup in string format', () => {
    t`hello, ${'brian'}`;

    expect(lookupTranslation).toHaveBeenCalledWith('en', 'hello, brian', {
      $format: 'STRING',
      $locale: 'en',
    });
  });

  describe('production', () => {
    beforeEach(() => {
      vi.stubEnv('NODE_ENV', 'production');
      currentLocale = 'fr';
    });

    it('reads translations from the snapshot by source hash or compiler hash', () => {
      setGlobalTranslationsSnapshot({
        fr: {
          [hashSource({ source: 'Hello', dataFormat: 'ICU' })]: 'Bonjour',
          compilerHash: 'Bonjour, {name}',
        },
      });

      expect(t('Hello')).toBe('Bonjour');
      expect(
        t('Hello, {name}', { name: 'Brian', $_hash: 'compilerHash' })
      ).toBe('Bonjour, Brian');
      expect(lookupTranslation).not.toHaveBeenCalled();
    });

    it('falls back to the source for a missing entry or locale', () => {
      setGlobalTranslationsSnapshot({ fr: {} });

      expect(t('Hello, {name}', { name: 'Brian' })).toBe('Hello, Brian');
      expect(t('Hello', { $locale: 'es' })).toBe('Hello');
    });
  });
});
