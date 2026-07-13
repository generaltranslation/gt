import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  mockGetDictionary,
  mockGetI18nCache,
  mockGetI18nConfig,
  mockLoadDictionary,
  mockReactI18nCacheConstructor,
  mockResolveDictionaryLoader,
  mockSetI18nCache,
} = vi.hoisted(() => ({
  mockGetDictionary: vi.fn(),
  mockGetI18nCache: vi.fn(),
  mockGetI18nConfig: vi.fn(),
  mockLoadDictionary: vi.fn(),
  mockReactI18nCacheConstructor: vi.fn(),
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
  },
}));

vi.mock('../../dictionary/getDictionary', () => ({
  getDictionary: mockGetDictionary,
}));

vi.mock('../../resolvers/resolveDictionaryLoader', () => ({
  resolveDictionaryLoader: mockResolveDictionaryLoader,
}));

describe('NextI18nCache', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetI18nConfig.mockReturnValue({
      getDefaultLocale: () => 'en',
    });
    mockGetDictionary.mockReturnValue({
      greeting: 'Hello',
    });
    mockLoadDictionary.mockResolvedValue({
      greeting: 'Bonjour',
    });
    mockResolveDictionaryLoader.mockReturnValue(undefined);
  });

  it('seeds the source dictionary without a custom dictionary loader', async () => {
    const { NextI18nCache } = await import('../NextI18nCache');

    new NextI18nCache({});

    expect(mockResolveDictionaryLoader).toHaveBeenCalled();
    expect(mockGetDictionary).toHaveBeenCalled();
    expect(mockReactI18nCacheConstructor).toHaveBeenCalledWith({
      dictionary: {
        greeting: 'Hello',
      },
    });
  });

  it('preserves an explicit source dictionary', async () => {
    const { NextI18nCache } = await import('../NextI18nCache');

    new NextI18nCache({
      dictionary: {
        greeting: 'Explicit hello',
      },
    });

    expect(mockGetDictionary).not.toHaveBeenCalled();
    expect(mockReactI18nCacheConstructor).toHaveBeenCalledWith({
      dictionary: {
        greeting: 'Explicit hello',
      },
    });
  });

  it('wraps a configured dictionary loader', async () => {
    const loadDictionary = vi.fn().mockResolvedValue({
      greeting: 'Salut',
    });
    mockResolveDictionaryLoader.mockReturnValue(loadDictionary);
    const { NextI18nCache } = await import('../NextI18nCache');

    new NextI18nCache({});

    const params = mockReactI18nCacheConstructor.mock.calls[0][0] as {
      loadDictionary: (locale: string) => Promise<unknown>;
    };
    await expect(params.loadDictionary('fr')).resolves.toEqual({
      greeting: 'Salut',
    });
    expect(loadDictionary).toHaveBeenCalledWith('fr');
  });

  it('loads a target dictionary snapshot with the source dictionary', async () => {
    const { NextI18nCache } = await import('../NextI18nCache');
    const cache = new NextI18nCache({});

    await expect(cache.loadDictionaries('fr')).resolves.toEqual({
      fr: {
        greeting: 'Bonjour',
      },
      en: {
        greeting: 'Hello',
      },
    });

    expect(mockLoadDictionary).toHaveBeenCalledWith('fr');
  });

  it('loads one dictionary when the requested locale is the source locale', async () => {
    const { NextI18nCache } = await import('../NextI18nCache');
    const cache = new NextI18nCache({});

    await expect(cache.loadDictionaries('en')).resolves.toEqual({
      en: {
        greeting: 'Bonjour',
      },
    });

    expect(mockLoadDictionary).toHaveBeenCalledWith('en');
  });
});
