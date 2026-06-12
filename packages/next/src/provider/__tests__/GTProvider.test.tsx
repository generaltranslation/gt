import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  mockGetDictionary,
  mockGetDictionaryEntry,
  mockGetI18NConfig,
  mockGetLocale,
  mockGetNextI18nCache,
  mockLoadTranslations,
  mockMergeDictionaries,
  mockReactGTProvider,
} = vi.hoisted(() => ({
  mockGetDictionary: vi.fn(),
  mockGetDictionaryEntry: vi.fn(),
  mockGetI18NConfig: vi.fn(),
  mockGetLocale: vi.fn(),
  mockGetNextI18nCache: vi.fn(),
  mockLoadTranslations: vi.fn(),
  mockMergeDictionaries: vi.fn(),
  mockReactGTProvider: vi.fn(),
}));

vi.mock('../../config-dir/getI18NConfig', () => ({
  getI18NConfig: mockGetI18NConfig,
}));

vi.mock('../../dictionary/getDictionary', () => ({
  getDictionary: mockGetDictionary,
  getDictionaryEntry: mockGetDictionaryEntry,
}));

vi.mock('../../request/getLocale', () => ({
  getLocale: mockGetLocale,
}));

vi.mock('../../i18n-cache/NextI18nCache', () => ({
  getNextI18nCache: mockGetNextI18nCache,
}));

vi.mock('gt-react/context', () => ({
  GTProvider: mockReactGTProvider,
  ReactI18nCache: class ReactI18nCache {},
}));

vi.mock('gt-react/internal', () => ({
  mergeDictionaries: mockMergeDictionaries,
}));

describe('GTProvider', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetLocale.mockResolvedValue('fr');
    mockGetDictionary.mockResolvedValue({
      greeting: 'Hello',
    });
    mockGetDictionaryEntry.mockReturnValue({
      title: 'Title',
    });
    mockGetNextI18nCache.mockReturnValue({
      loadTranslations: mockLoadTranslations,
    });
    mockLoadTranslations.mockResolvedValue({
      hash: 'Salut',
    });
    mockMergeDictionaries.mockReturnValue({
      greeting: 'Bonjour',
    });
    mockGetI18NConfig.mockReturnValue({
      getCachedTranslations: vi.fn().mockResolvedValue({
        hash: 'Salut',
      }),
      getDictionaryTranslations: vi.fn().mockResolvedValue({
        greeting: 'Bonjour',
      }),
      requiresTranslation: vi.fn().mockReturnValue([true, false]),
    });
  });

  it('passes locale-scoped snapshots to gt-react/context GTProvider', async () => {
    const { GTProvider } = await import('../GTProvider');

    const element = await GTProvider({ children: 'content' });

    expect(mockGetLocale).toHaveBeenCalled();
    expect(React.isValidElement(element)).toBe(true);
    expect(element).toMatchObject({
      type: mockReactGTProvider,
      props: {
        children: 'content',
        dictionaries: {
          fr: {
            greeting: 'Bonjour',
          },
        },
        enableI18n: true,
        locale: 'fr',
        translations: {
          fr: {
            hash: 'Salut',
          },
        },
      },
    });
  });

  it('uses explicit locale and skips cached translations when translation is not required', async () => {
    const config = {
      getCachedTranslations: vi.fn().mockResolvedValue({
        hash: 'Hola',
      }),
      getDictionaryTranslations: vi.fn().mockResolvedValue({}),
      requiresTranslation: vi.fn().mockReturnValue([false, false]),
    };
    mockGetI18NConfig.mockReturnValue(config);

    const { GTProvider } = await import('../GTProvider');

    const element = await GTProvider({
      children: 'content',
      id: 'marketing.hero',
      locale: 'en',
    });

    expect(mockGetLocale).not.toHaveBeenCalled();
    expect(mockGetDictionaryEntry).toHaveBeenCalledWith('marketing.hero');
    expect(mockLoadTranslations).not.toHaveBeenCalled();
    expect(config.getCachedTranslations).not.toHaveBeenCalled();
    expect(React.isValidElement(element)).toBe(true);
    expect(element).toMatchObject({
      type: mockReactGTProvider,
      props: {
        dictionaries: {
          en: {
            greeting: 'Bonjour',
          },
        },
        enableI18n: false,
        locale: 'en',
        translations: {
          en: {},
        },
      },
    });
  });
});
