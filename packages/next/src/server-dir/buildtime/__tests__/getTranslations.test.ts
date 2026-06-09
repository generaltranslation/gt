import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  I18nCache,
  hashMessage,
  initializeI18nConfig,
  setI18nCache,
} from 'gt-i18n/internal';
import type { Dictionary } from 'gt-i18n/types';

const { mockGetRequestConditions, mockGetDictionary, mockGetI18NConfig } =
  vi.hoisted(() => ({
    mockGetRequestConditions: vi.fn(),
    mockGetDictionary: vi.fn(),
    mockGetI18NConfig: vi.fn(),
  }));

vi.mock('../../../request/getRequestConditions', () => ({
  getRequestConditions: mockGetRequestConditions,
}));
vi.mock('../../../dictionary/getDictionary', () => ({
  getDictionary: mockGetDictionary,
}));
vi.mock('../../../config-dir/getI18NConfig', () => ({
  getI18NConfig: mockGetI18NConfig,
}));

import { getTranslations, useTranslations } from '../getTranslations';

type SetupParams = {
  locale?: string;
  enableI18n?: boolean;
  dictionary?: Dictionary;
  dictionaryTranslations?: Dictionary;
  translations?: Record<string, string>;
};

function setup({
  locale = 'en',
  enableI18n = true,
  dictionary = {},
  dictionaryTranslations = {},
  translations = {},
}: SetupParams = {}) {
  initializeI18nConfig({ defaultLocale: 'en', locales: ['en', 'es'] });
  const i18nCache = new I18nCache({
    dictionary: {},
    loadTranslations: vi.fn().mockResolvedValue(translations),
    loadDictionary: vi.fn().mockResolvedValue(dictionaryTranslations),
  });
  setI18nCache(i18nCache);

  mockGetRequestConditions.mockResolvedValue({
    _locale: locale,
    _enableI18n: enableI18n,
  });
  mockGetDictionary.mockResolvedValue(dictionary);
  mockGetI18NConfig.mockReturnValue({
    setSourceDictionary: (sourceDictionary: Dictionary) =>
      i18nCache.updateDictionaries({ en: sourceDictionary }),
  });
  return i18nCache;
}

describe('getTranslations', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('with the default locale', () => {
    it('should render the source entry with interpolation', async () => {
      setup({ dictionary: { greeting: 'Hello, {name}!' } });

      const t = await getTranslations();

      expect(t('greeting', { name: 'Alice' })).toBe('Hello, Alice!');
    });

    it('should prepend the id prefix to translation keys', async () => {
      setup({ dictionary: { user: { name: 'User name' } } });

      const t = await getTranslations('user');

      expect(t('name')).toBe('User name');
    });

    it('should throw when the entry cannot be found', async () => {
      setup();

      const t = await getTranslations();

      expect(() => t('missing.key')).toThrow(
        'Dictionary entry missing.key cannot be found'
      );
    });
  });

  describe('with translation required', () => {
    it('should prefer entries from the locale dictionary', async () => {
      setup({
        locale: 'es',
        dictionary: { greeting: 'Hello' },
        dictionaryTranslations: { greeting: 'Hola' },
      });

      const t = await getTranslations();

      expect(t('greeting')).toBe('Hola');
    });

    it('should fall back to cached translations', async () => {
      const message = 'Hello';
      setup({
        locale: 'es',
        dictionary: { greeting: message },
        translations: {
          [hashMessage(message, { $format: 'ICU' })]: 'Hola',
        },
      });

      const t = await getTranslations();

      expect(t('greeting')).toBe('Hola');
    });

    it('should render the source when i18n is disabled', async () => {
      setup({
        locale: 'es',
        enableI18n: false,
        dictionary: { greeting: 'Hello' },
        dictionaryTranslations: { greeting: 'Hola' },
      });

      const t = await getTranslations();

      expect(t('greeting')).toBe('Hello');
    });
  });

  describe('t.obj()', () => {
    it('should render a source subtree for the default locale', async () => {
      setup({ dictionary: { menu: { open: 'Open', close: 'Close' } } });

      const t = await getTranslations();

      expect(t.obj('menu')).toEqual({ open: 'Open', close: 'Close' });
    });

    it('should merge locale dictionary entries with translations', async () => {
      setup({
        locale: 'es',
        dictionary: { menu: { open: 'Open', close: 'Close' } },
        dictionaryTranslations: { menu: { open: 'Abrir' } },
        translations: {
          [hashMessage('Close', { $format: 'ICU' })]: 'Cerrar',
        },
      });

      const t = await getTranslations();

      expect(t.obj('menu')).toEqual({ open: 'Abrir', close: 'Cerrar' });
    });

    it('should prepend the id prefix to subtree keys', async () => {
      setup({ dictionary: { user: { fields: { name: 'Name' } } } });

      const t = await getTranslations('user');

      expect(t.obj('fields')).toEqual({ name: 'Name' });
    });

    it('should throw when the subtree cannot be found', async () => {
      setup();

      const t = await getTranslations();

      expect(() => t.obj('missing.path')).toThrow(
        'Dictionary entry missing.path cannot be found'
      );
    });
  });
});

describe('useTranslations', () => {
  it('should exist and be exportable', () => {
    expect(typeof useTranslations).toBe('function');
    expect(useTranslations.length).toBe(1);
  });
});
