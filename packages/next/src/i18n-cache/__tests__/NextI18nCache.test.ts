import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  mockGetDictionary,
  mockGetDictionaryEntry,
  mockGetI18nCache,
  mockLoadDictionary,
  mockGetEntry,
  mockReactI18nCacheConstructor,
  mockResolveDictionaryLoader,
  mockSetI18nCache,
  mockUpdateDictionaries,
} = vi.hoisted(() => ({
  mockGetDictionary: vi.fn(),
  mockGetDictionaryEntry: vi.fn(),
  mockGetI18nCache: vi.fn(),
  mockLoadDictionary: vi.fn(),
  mockGetEntry: vi.fn(),
  mockReactI18nCacheConstructor: vi.fn(),
  mockResolveDictionaryLoader: vi.fn(),
  mockSetI18nCache: vi.fn(),
  mockUpdateDictionaries: vi.fn(),
}));

vi.mock('gt-i18n/internal', () => ({
  getI18nCache: mockGetI18nCache,
  getI18nConfig: () => ({ getDefaultLocale: () => 'en' }),
  setI18nCache: mockSetI18nCache,
  I18nCache: class {},
}));

vi.mock('gt-react', () => ({
  ReactI18nCache: class {
    constructor(params: unknown) {
      mockReactI18nCacheConstructor(params);
    }

    loadDictionary(locale: string) {
      return mockLoadDictionary(locale);
    }

    updateDictionaries(dictionaries: unknown) {
      mockUpdateDictionaries(dictionaries);
    }
  },
}));

vi.mock('@generaltranslation/react-core/pure', () => ({
  getDictionaryEntry: mockGetEntry,
}));

vi.mock('../../dictionary/getDictionary', () => ({
  getDictionary: mockGetDictionary,
  getDictionaryEntry: mockGetDictionaryEntry,
}));

vi.mock('../../resolvers/resolveDictionaryLoader', () => ({
  resolveDictionaryLoader: mockResolveDictionaryLoader,
}));

vi.mock('../../errors/createErrors', () => ({
  createDictionarySubsetError: (id: string, functionName: string) =>
    `${functionName} with id "${id}" could not read a valid dictionary subtree`,
}));

describe('NextI18nCache', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockLoadDictionary.mockResolvedValue({
      greeting: 'Bonjour',
    });
    mockGetDictionary.mockResolvedValue({
      greeting: 'Hello',
    });
    mockGetDictionaryEntry.mockReturnValue({
      title: 'Title',
    });
    mockGetEntry.mockImplementation((dictionary, id) => {
      let current = dictionary;
      for (const segment of id.split('.')) {
        current = current?.[segment];
      }
      return current;
    });
  });

  it('loads source and locale-scoped dictionaries snapshots', async () => {
    const { NextI18nCache } = await import('../NextI18nCache');
    const cache = new NextI18nCache({});

    await expect(cache.loadDictionaries('fr')).resolves.toEqual({
      en: {
        greeting: 'Hello',
      },
      fr: {
        greeting: 'Bonjour',
      },
    });

    expect(mockGetDictionary).toHaveBeenCalled();
    expect(mockGetDictionaryEntry).not.toHaveBeenCalled();
    expect(mockLoadDictionary).toHaveBeenCalledWith('fr');
    expect(mockUpdateDictionaries).toHaveBeenCalledWith({
      en: {
        greeting: 'Hello',
      },
      fr: {
        greeting: 'Bonjour',
      },
    });
  });

  it('loads, validates, and re-wraps a prefixed dictionary subtree', async () => {
    const { NextI18nCache } = await import('../NextI18nCache');
    const cache = new NextI18nCache({});
    mockLoadDictionary.mockResolvedValue({
      marketing: {
        hero: {
          title: 'Titre',
        },
      },
    });

    await expect(
      cache.loadDictionaries('fr', 'marketing.hero')
    ).resolves.toEqual({
      en: {
        marketing: {
          hero: {
            title: 'Title',
          },
        },
      },
      fr: {
        marketing: {
          hero: {
            title: 'Titre',
          },
        },
      },
    });

    expect(mockGetDictionary).not.toHaveBeenCalled();
    expect(mockGetDictionaryEntry).toHaveBeenCalledWith('marketing.hero');
    expect(mockLoadDictionary).toHaveBeenCalledWith('fr');
  });

  it('throws when a prefixed dictionary subtree is not an object', async () => {
    const { NextI18nCache } = await import('../NextI18nCache');
    const cache = new NextI18nCache({});
    mockGetDictionaryEntry.mockReturnValue(React.createElement('span'));

    await expect(
      cache.loadDictionaries('fr', 'marketing.hero')
    ).rejects.toThrow(
      '<GTProvider> with id "marketing.hero" could not read a valid dictionary subtree'
    );
  });
});
