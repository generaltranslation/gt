import { hashSource } from 'generaltranslation/id';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { setReadonlyConditionStore } from '../../condition-store/singleton-operations';
import type { ReactI18nCache } from '../../i18n-cache/ReactI18nCache';
import { setReactI18nCache } from '../../i18n-cache/singleton-operations';
import { initializeI18nConfig } from '../../setup/i18nConfig';
import { t } from '../t';

type TestGlobal = typeof globalThis & { __generaltranslation?: unknown };

const saveTree = 'Save';
const translations: Record<string, unknown> = {
  [hashSource({ source: saveTree, dataFormat: 'ICU_TREE' })]: 'Enregistrer',
  [hashSource({ source: saveTree, dataFormat: 'ICU_TREE', context: 'button' })]:
    'Sauvegarder',
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

describe('react-core/unstable t', () => {
  beforeEach(() => {
    Reflect.deleteProperty(globalThis as TestGlobal, '__generaltranslation');
    setReactI18nCache({
      lookupTranslation: vi.fn(
        (locale: string, message: string, options: { $context?: string }) =>
          locale === 'fr'
            ? translations[
                hashSource({
                  source: message,
                  dataFormat: 'ICU_TREE',
                  context: options.$context,
                })
              ]
            : undefined
      ),
    } as unknown as ReactI18nCache);
  });

  it('translates with the condition store locale', () => {
    initializeI18nConfig({ defaultLocale: 'en', locales: ['en', 'fr'] }, 'SPA');
    setConditions('fr');

    expect(t`Save`).toBe('Enregistrer');
    expect(t({ context: 'button' })`Save`).toBe('Sauvegarder');
  });

  it('renders the source when i18n is disabled', () => {
    initializeI18nConfig({ defaultLocale: 'en', locales: ['en', 'fr'] }, 'SPA');
    setConditions('fr', false);

    expect(t`Save`).toBe('Save');
  });

  it('works at module level in an SPA, before any request scope', () => {
    initializeI18nConfig({ defaultLocale: 'en', locales: ['en', 'fr'] }, 'SPA');
    setConditions('fr');

    // A module-level constant, evaluated once at import time.
    const label = t`Save`;
    expect(label).toBe('Enregistrer');
  });

  it('rejects every call in server-rendered apps in development', () => {
    vi.stubEnv('NODE_ENV', 'development');
    initializeI18nConfig(
      { defaultLocale: 'en', locales: ['en', 'fr'] },
      'server-render'
    );
    setConditions('fr');

    try {
      expect(() => t`Save`).toThrow(/only available in client-rendered/);
      expect(() => t({ context: 'button' })`Save`).toThrow(/Message: "Save"/);
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
      expect(t`Save`).toBe('Save');
      expect(t({ context: 'button' })`Save`).toBe('Save');
      expect(error).toHaveBeenCalledTimes(2);
      expect(error).toHaveBeenCalledWith(
        expect.stringContaining('use useGT()')
      );
    } finally {
      error.mockRestore();
      vi.unstubAllEnvs();
    }
  });
});
