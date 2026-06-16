import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  mockGetDictionary,
  mockGetDictionaryEntry,
  mockGetI18nCache,
  mockLoadDictionary,
  mockMergeDictionaries,
  mockReactI18nCacheConstructor,
  mockResolveDictionaryLoader,
  mockSetI18nCache,
} = vi.hoisted(() => ({
  mockGetDictionary: vi.fn(),
  mockGetDictionaryEntry: vi.fn(),
  mockGetI18nCache: vi.fn(),
  mockLoadDictionary: vi.fn(),
  mockMergeDictionaries: vi.fn(),
  mockReactI18nCacheConstructor: vi.fn(),
  mockResolveDictionaryLoader: vi.fn(),
  mockSetI18nCache: vi.fn(),
}));

vi.mock('gt-i18n/internal', () => ({
  getI18nCache: mockGetI18nCache,
  setI18nCache: mockSetI18nCache,
  I18nCache: class {},
}));

vi.mock('gt-react/context', () => ({
  ReactI18nCache: class {
    constructor(params: unknown) {
      mockReactI18nCacheConstructor(params);
    }

    loadDictionary(locale: string) {
      return mockLoadDictionary(locale);
    }
  },
}));

vi.mock('gt-react/internal', () => ({
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
    mockMergeDictionaries.mockReturnValue({
      greeting: 'Bonjour',
    });
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
