import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  mockGetDictionary,
  mockGetDictionaryManager,
  mockGetI18nConfig,
  mockInitializeDictionaryManager,
  mockIsDictionaryManagerInitialized,
  mockLoadDictionary,
  mockResolveDictionaryLoader,
} = vi.hoisted(() => ({
  mockGetDictionary: vi.fn(),
  mockGetDictionaryManager: vi.fn(),
  mockGetI18nConfig: vi.fn(),
  mockInitializeDictionaryManager: vi.fn(),
  mockIsDictionaryManagerInitialized: vi.fn(),
  mockLoadDictionary: vi.fn(),
  mockResolveDictionaryLoader: vi.fn(),
}));

vi.mock('gt-i18n/internal', () => ({
  getDictionaryManager: mockGetDictionaryManager,
  getI18nConfig: mockGetI18nConfig,
  initializeDictionaryManager: mockInitializeDictionaryManager,
  isDictionaryManagerInitialized: mockIsDictionaryManagerInitialized,
}));

vi.mock('../../setup/shared', () => ({
  getParams: () => ({ nextI18nCacheParams: { cacheExpiryTime: 1000 } }),
}));

vi.mock('../getDictionary', () => ({
  getDictionary: mockGetDictionary,
}));

vi.mock('../resolveDictionaryLoader', () => ({
  resolveDictionaryLoader: mockResolveDictionaryLoader,
}));

describe('gt-next compat dictionaries', () => {
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
    mockGetDictionaryManager.mockReturnValue({
      loadDictionary: mockLoadDictionary,
    });
    mockIsDictionaryManagerInitialized.mockReturnValue(false);
    mockResolveDictionaryLoader.mockReturnValue(undefined);
  });

  it('seeds the source dictionary without a custom dictionary loader', async () => {
    const { ensureNextDictionaryManager } = await import('../dictionaries');

    ensureNextDictionaryManager();

    expect(mockResolveDictionaryLoader).toHaveBeenCalled();
    expect(mockGetDictionary).toHaveBeenCalled();
    expect(mockInitializeDictionaryManager).toHaveBeenCalledWith({
      dictionary: {
        greeting: 'Hello',
      },
      cacheExpiryTime: 1000,
    });
  });

  it('does not replace an existing dictionary manager', async () => {
    mockIsDictionaryManagerInitialized.mockReturnValue(true);
    const { ensureNextDictionaryManager } = await import('../dictionaries');

    ensureNextDictionaryManager();

    expect(mockInitializeDictionaryManager).not.toHaveBeenCalled();
    expect(mockGetDictionary).not.toHaveBeenCalled();
  });

  it('wraps a configured dictionary loader', async () => {
    const loadDictionary = vi.fn().mockResolvedValue(undefined);
    mockResolveDictionaryLoader.mockReturnValue(loadDictionary);
    const { ensureNextDictionaryManager } = await import('../dictionaries');

    ensureNextDictionaryManager();

    const params = mockInitializeDictionaryManager.mock.calls[0][0] as {
      loadDictionary: (locale: string) => Promise<unknown>;
    };
    await expect(params.loadDictionary('fr')).resolves.toEqual({});
    expect(loadDictionary).toHaveBeenCalledWith('fr');
  });

  it('loads a target dictionary snapshot with the source dictionary', async () => {
    const { loadDictionaries } = await import('../dictionaries');

    await expect(loadDictionaries('fr')).resolves.toEqual({
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
    const { loadDictionaries } = await import('../dictionaries');

    await expect(loadDictionaries('en')).resolves.toEqual({
      en: {
        greeting: 'Bonjour',
      },
    });

    expect(mockLoadDictionary).toHaveBeenCalledWith('en');
  });
});
