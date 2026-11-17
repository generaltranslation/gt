import { hashSource } from 'generaltranslation/id';
import { msg } from 'gt-i18n/unstable';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { setReadonlyConditionStore } from '../../condition-store/singleton-operations';
import type { ReactI18nCache } from '../../i18n-cache/ReactI18nCache';
import { setReactI18nCache } from '../../i18n-cache/singleton-operations';
import { initializeI18nConfig } from '../../setup/i18nConfig';
import { m } from '../m';

type TestGlobal = typeof globalThis & { __generaltranslation?: unknown };

const keyOf = (source: unknown) =>
  hashSource({ source: source as string, dataFormat: 'MESSAGE_TREE' });

const name = 'Ada';
const translations: Record<string, unknown> = {
  [keyOf('Save')]: 'Enregistrer',
  [keyOf(msg`Hello, ${{ name }}!`.tree)]: ['Bonjour, ', ['name'], ' !'],
};

function setConditions(locale: string, enableI18n = true) {
  setReadonlyConditionStore({
    getLocale: () => locale,
    getRegion: () => undefined,
    getEnableI18n: () => enableI18n,
    setLocale: () => {},
    setRegion: () => {},
    setEnableI18n: () => {},
  });
}

describe('react-core/unstable m', () => {
  beforeEach(() => {
    Reflect.deleteProperty(globalThis as TestGlobal, '__generaltranslation');
    setReactI18nCache({
      lookupTranslation: vi.fn((locale: string, message: unknown) =>
        locale === 'fr' ? translations[keyOf(message)] : undefined
      ),
    } as unknown as ReactI18nCache);
  });

  it('renders messages from msg() with the condition store locale', () => {
    initializeI18nConfig({ defaultLocale: 'en', locales: ['en', 'fr'] }, 'SPA');
    setConditions('fr');

    const greeting = msg`Hello, ${{ name }}!`;
    expect(m(msg('Save'))).toBe('Enregistrer');
    expect(m(greeting)).toBe('Bonjour, Ada !');
    expect(m(greeting, { name: 'Bo' })).toBe('Bonjour, Bo !');
    expect(m(null)).toBeNull();
  });

  it('renders the source when i18n is disabled', () => {
    initializeI18nConfig({ defaultLocale: 'en', locales: ['en', 'fr'] }, 'SPA');
    setConditions('fr', false);

    expect(m(msg('Save'))).toBe('Save');
  });

  it('rejects every call in server-rendered apps in development', () => {
    vi.stubEnv('NODE_ENV', 'development');
    initializeI18nConfig(
      { defaultLocale: 'en', locales: ['en', 'fr'] },
      'server-render'
    );
    setConditions('fr');

    try {
      expect(() => m(msg('Save'))).toThrow(/only available in client-rendered/);
      expect(() => m(msg`Hello, ${{ name }}!`)).toThrow(/Message: "Hello, !"/);
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it('logs and renders the source in server-rendered apps in production', () => {
    vi.stubEnv('NODE_ENV', 'production');
    initializeI18nConfig(
      { defaultLocale: 'en', locales: ['en', 'fr'] },
      'server-render'
    );
    setConditions('fr');
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});

    try {
      expect(m(msg('Save'))).toBe('Save');
      expect(m(msg`Hello, ${{ name }}!`)).toBe('Hello, Ada!');
      expect(error).toHaveBeenCalledTimes(2);
      expect(error).toHaveBeenCalledWith(
        expect.stringContaining('use useMessages()')
      );
    } finally {
      error.mockRestore();
      vi.unstubAllEnvs();
    }
  });
});
