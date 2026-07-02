import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  mockGetDictionary,
  mockGetDictionaryEntry,
  mockGetI18nCache,
  mockGetI18nConfig,
  mockLoadDictionary,
  mockMergeDictionaries,
  mockReactGetLookupDictionary,
  mockReactI18nCacheConstructor,
  mockReactUpdateDictionaries,
  mockResolveDictionaryLoader,
  mockSetI18nCache,
} = vi.hoisted(() => ({
  mockGetDictionary: vi.fn(),
  mockGetDictionaryEntry: vi.fn(),
  mockGetI18nCache: vi.fn(),
  mockGetI18nConfig: vi.fn(),
  mockLoadDictionary: vi.fn(),
  mockMergeDictionaries: vi.fn(),
  mockReactGetLookupDictionary: vi.fn(),
  mockReactI18nCacheConstructor: vi.fn(),
  mockReactUpdateDictionaries: vi.fn(),
  mockResolveDictionaryLoader: vi.fn(),
  mockSetI18nCache: vi.fn(),
}));

vi.mock('gt-i18n/internal', () => ({
  getI18nCache: mockGetI18nCache,
  getI18nConfig: mockGetI18nConfig,
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
      mockReactUpdateDictionaries(dictionaries);
    }

    getLookupDictionary(locale: string) {
      return mockReactGetLookupDictionary(locale);
    }
  },
}));

vi.mock('@generaltranslation/react-core/pure', () => ({
  mergeDictionaries: mockMergeDictionaries,
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
    mockGetI18nConfig.mockReturnValue({
      getDefaultLocale: () => 'en',
    });
    mockMergeDictionaries.mockReturnValue({
      greeting: 'Bonjour',
    });
    mockReactGetLookupDictionary.mockResolvedValue({
      lookupDictionary: vi.fn(),
      lookupDictionaryObj: vi.fn(),
    });
  });

  it('uses the root dictionary instead of the loader for the default locale', async () => {
    const { NextI18nCache } = await import('../NextI18nCache');
    new NextI18nCache({
      loadDictionary: mockLoadDictionary,
    });
    const params = mockReactI18nCacheConstructor.mock.calls[0][0] as {
      loadDictionary: (locale: string) => Promise<unknown>;
    };

    await expect(params.loadDictionary('en')).resolves.toEqual({
      greeting: 'Hello',
    });

    expect(mockGetDictionary).toHaveBeenCalled();
    expect(mockLoadDictionary).not.toHaveBeenCalled();
  });

  it('uses the loader for non-default locales', async () => {
    const { NextI18nCache } = await import('../NextI18nCache');
    new NextI18nCache({
      loadDictionary: mockLoadDictionary,
    });
    const params = mockReactI18nCacheConstructor.mock.calls[0][0] as {
      loadDictionary: (locale: string) => Promise<unknown>;
    };

    await expect(params.loadDictionary('fr')).resolves.toEqual({
      greeting: 'Bonjour',
    });

    expect(mockGetDictionary).not.toHaveBeenCalled();
    expect(mockLoadDictionary).toHaveBeenCalledWith('fr');
  });

  it('loads a locale-scoped dictionaries snapshot', async () => {
    const { NextI18nCache } = await import('../NextI18nCache');
    const cache = new NextI18nCache({});

    await expect(cache.loadDictionaries('fr')).resolves.toEqual({
      fr: {
        greeting: 'Bonjour',
      },
    });

    expect(mockGetDictionary).toHaveBeenCalled();
    expect(mockGetDictionaryEntry).not.toHaveBeenCalled();
    expect(mockLoadDictionary).toHaveBeenCalledWith('fr');
    expect(mockMergeDictionaries).toHaveBeenCalledWith(
      {
        greeting: 'Hello',
      },
      {
        greeting: 'Bonjour',
      }
    );
  });

  it('loads, validates, and re-wraps a prefixed dictionary subtree', async () => {
    const { NextI18nCache } = await import('../NextI18nCache');
    const cache = new NextI18nCache({});

    await cache.loadDictionaries('fr', 'marketing.hero');

    expect(mockGetDictionary).not.toHaveBeenCalled();
    expect(mockGetDictionaryEntry).toHaveBeenCalledWith('marketing.hero');
    expect(mockLoadDictionary).toHaveBeenCalledWith('fr');
    expect(mockMergeDictionaries).toHaveBeenCalledWith(
      {
        marketing: {
          hero: {
            title: 'Title',
          },
        },
      },
      {
        greeting: 'Bonjour',
      }
    );
  });

  it('updates dictionaries before delegating lookup dictionary resolution', async () => {
    const lookupDictionary = {
      lookupDictionary: vi.fn(),
      lookupDictionaryObj: vi.fn(),
    };
    mockLoadDictionary.mockResolvedValue({});
    mockMergeDictionaries.mockReturnValue({
      greeting: 'Hello',
    });
    mockReactGetLookupDictionary.mockResolvedValue(lookupDictionary);
    const { NextI18nCache } = await import('../NextI18nCache');
    const cache = new NextI18nCache({});

    await expect(cache.getLookupDictionary('en')).resolves.toBe(
      lookupDictionary
    );

    expect(mockReactUpdateDictionaries).toHaveBeenCalledWith({
      en: { greeting: 'Hello' },
    });
    expect(mockReactGetLookupDictionary).toHaveBeenCalledWith('en');
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
