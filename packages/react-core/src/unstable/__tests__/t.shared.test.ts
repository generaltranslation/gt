import { hashMessageTree } from 'generaltranslation/id';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { setReadonlyConditionStore } from '../../condition-store/singleton-operations';
import type { ReactI18nCache } from '../../i18n-cache/ReactI18nCache';
import { setReactI18nCache } from '../../i18n-cache/singleton-operations';
import { initializeI18nConfig } from '../../setup/i18nConfig';
import { t } from '../t.shared';

type TestGlobal = typeof globalThis & { __generaltranslation?: unknown };

const saveTree = [{ type: 0, value: 'Save' }];
const translations: Record<string, unknown> = {
  [hashMessageTree(saveTree)]: [{ type: 0, value: 'Enregistrer' }],
  [hashMessageTree(saveTree, { context: 'button' })]: [
    { type: 0, value: 'Sauvegarder' },
  ],
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
      lookupTranslationByHash: vi.fn((locale: string, hash: string) =>
        locale === 'fr' ? translations[hash] : undefined
      ),
    } as unknown as ReactI18nCache);
  });

  it('translates with the condition store locale', () => {
    initializeI18nConfig({ defaultLocale: 'en', locales: ['en', 'fr'] }, 'SPA');
    setConditions('fr');

    expect(t`Save`).toBe('Enregistrer');
    expect(t({ context: 'button' })`Save`).toBe('Sauvegarder');
  });

  it('translates a loaded locale override on a default-locale page', () => {
    initializeI18nConfig({ defaultLocale: 'en', locales: ['en', 'fr'] }, 'SPA');
    setConditions('en');

    expect(t`Save`).toBe('Save');
    expect(t({ locale: 'fr' })`Save`).toBe('Enregistrer');
  });

  it('renders the source when i18n is disabled', () => {
    initializeI18nConfig({ defaultLocale: 'en', locales: ['en', 'fr'] }, 'SPA');
    setConditions('fr', false);

    expect(t`Save`).toBe('Save');
    expect(t({ locale: 'fr' })`Save`).toBe('Save');
  });

  it('rejects module-level calls in server-rendered apps', () => {
    initializeI18nConfig(
      { defaultLocale: 'en', locales: ['en', 'fr'] },
      'server-render'
    );
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});

    try {
      // Outside development the rule logs; reading the missing store then throws.
      expect(() => t`Save`).toThrow(/ConditionStore is unavailable/);
      expect(() => t({ context: 'button' })`Save`).toThrow();
      expect(error).toHaveBeenCalledTimes(2);
      expect(error).toHaveBeenCalledWith(
        expect.stringContaining('Message: "Save"')
      );
    } finally {
      error.mockRestore();
    }
  });
});
