import { describe, it, expect, vi, beforeEach } from 'vitest';
import { I18nManager } from '../I18nManager';
import { hashMessage } from '../../utils/hashMessage';
import { LookupOptions } from '../../translation-functions/types/options';

// Mock createTranslateManyFactory to inject a controlled translateMany
const mockTranslateMany = vi.fn();
vi.mock('../translations-manager/utils/createTranslateMany', () => ({
  createTranslateManyFactory: vi.fn().mockReturnValue(() => mockTranslateMany),
}));

// Test data
const message = 'Hello {name}!';
const lookupOptions: LookupOptions = {
  $format: 'ICU',
  $context: 'greeting',
};
const expectedHash = hashMessage(message, lookupOptions);
const translatedString = 'Bonjour {name} !';

function createManager(overrides: Record<string, unknown> = {}) {
  return new I18nManager({
    defaultLocale: 'en',
    locales: ['en', 'fr', 'es'],
    loadTranslations: vi
      .fn()
      .mockResolvedValue({ [expectedHash]: translatedString }),
    ...overrides,
  });
}

describe('I18nManager', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockTranslateMany.mockReset();
  });

  // ===== REGRESSION TESTS ===== //

  it('resolveTranslationSync returns translation after loadTranslations', async () => {
    const manager = createManager();

    // Load translations first
    await manager.loadTranslations('fr');

    // Now sync resolution should work
    const result = manager.resolveTranslationSync('fr', message, lookupOptions);
    expect(result).toBe(translatedString);
  });

  it('getTranslations returns empty object for invalid locale', async () => {
    const manager = createManager();

    const result = await manager.getTranslations('zh');
    expect(result).toEqual({});
  });

  it('getTranslationResolver returns a working resolver function', async () => {
    const manager = createManager();

    const resolver = await manager.getTranslationResolver('fr');
    const result = resolver(message, lookupOptions);

    expect(result).toBe(translatedString);
  });

  // ===== NEW BEHAVIOR TESTS ===== //

  it('loadTranslations() returns Record<Hash, Translation>', async () => {
    const manager = createManager();

    const translations = await manager.loadTranslations('fr');

    expect(translations[expectedHash]).toBe(translatedString);
  });

  it('loadDictionary() returns default locale dictionary without calling loadDictionary', async () => {
    const loadDictionary = vi.fn().mockResolvedValue({ greeting: 'Bonjour' });
    const manager = createManager({
      dictionary: {
        greeting: 'Hello',
      },
      loadDictionary,
    });

    const dictionary = await manager.loadDictionary('en');

    expect(dictionary).toEqual({ greeting: 'Hello' });
    expect(loadDictionary).not.toHaveBeenCalled();
  });

  it('loadDictionary() loads and caches dictionary for requested locale', async () => {
    const loadDictionary = vi.fn().mockResolvedValue({
      greeting: 'Bonjour',
      user: {
        name: 'Nom',
      },
    });
    const manager = createManager({
      dictionary: {
        greeting: 'Hello',
      },
      loadDictionary,
    });

    const dictionary = await manager.loadDictionary('fr');
    const cachedDictionary = await manager.loadDictionary('fr');

    expect(loadDictionary).toHaveBeenCalledTimes(1);
    expect(loadDictionary).toHaveBeenCalledWith('fr');
    expect(dictionary).toEqual({
      greeting: 'Bonjour',
      user: {
        name: 'Nom',
      },
    });
    expect(cachedDictionary).toBe(dictionary);
  });

  it('lookupTranslation() returns undefined before load, translation after', async () => {
    const manager = createManager();

    // Before loading
    const before = manager.lookupTranslation('fr', message, lookupOptions);
    expect(before).toBeUndefined();

    // Load translations
    await manager.loadTranslations('fr');

    // After loading
    const after = manager.lookupTranslation('fr', message, lookupOptions);
    expect(after).toBe(translatedString);
  });

  it('lookupTranslationWithFallback() falls back to runtime translate on cache miss', async () => {
    const unknownMessage = 'Unknown message';
    const unknownOptions: LookupOptions = { $format: 'ICU' };
    const unknownHash = hashMessage(unknownMessage, unknownOptions);

    // loadTranslations returns translations that do NOT include unknownMessage
    const manager = createManager();

    // Mock translateMany to return a translation for the unknown message
    mockTranslateMany.mockResolvedValue({
      [unknownHash]: {
        success: true,
        translation: 'Message inconnu',
      },
    });

    const result = await manager.lookupTranslationWithFallback(
      'fr',
      unknownMessage,
      unknownOptions
    );

    expect(result).toBe('Message inconnu');
    expect(mockTranslateMany).toHaveBeenCalled();
  });

  it('resolves custom aliases for locale metadata operations', () => {
    const manager = createManager({
      customMapping: {
        'brand-french': {
          code: 'fr',
          name: 'Brand French',
        },
      },
    });

    expect(manager.requiresTranslation('brand-french')).toBe(true);
    expect(manager.requiresDialectTranslation('en-US')).toBe(false);
    expect(() => manager.getGTClass('brand-french')).not.toThrow();
  });

  it('normalizes custom aliases before loading and reading locale caches', async () => {
    const loadTranslations = vi
      .fn()
      .mockResolvedValue({ [expectedHash]: translatedString });
    const manager = createManager({
      loadTranslations,
      customMapping: {
        'brand-french': {
          code: 'fr',
          name: 'Brand French',
        },
      },
    });

    await manager.loadTranslations('brand-french');

    expect(loadTranslations).toHaveBeenCalledTimes(1);
    expect(loadTranslations).toHaveBeenCalledWith('fr');
    expect(
      manager.lookupTranslation('brand-french', message, lookupOptions)
    ).toBe(translatedString);
    expect(loadTranslations).toHaveBeenCalledTimes(1);
  });

  it('does not need current locale state for explicit locale operations', async () => {
    const loadTranslations = vi
      .fn()
      .mockResolvedValue({ [expectedHash]: translatedString });
    const manager = createManager({
      loadTranslations,
    });

    await manager.loadTranslations('fr');

    expect(loadTranslations).toHaveBeenCalledWith('fr');
    expect(manager.lookupTranslation('fr', message, lookupOptions)).toBe(
      translatedString
    );
    await expect(
      manager.lookupTranslationWithFallback('fr', message, lookupOptions)
    ).resolves.toBe(translatedString);
    await expect(manager.getLookupTranslation('fr')).resolves.toEqual(
      expect.any(Function)
    );
    expect(manager.requiresTranslation('fr')).toBe(true);
    expect(manager.requiresDialectTranslation('fr')).toBe(false);
    expect(() => manager.getGTClass('fr')).not.toThrow();
  });

  it('emits dictionary cache lifecycle events', async () => {
    const manager = createManager({
      dictionary: {
        greeting: 'Hello',
      },
      loadDictionary: vi.fn().mockResolvedValue({
        greeting: 'Bonjour',
      }),
    });
    const localesDictionaryMiss = vi.fn();
    const localesDictionaryHit = vi.fn();
    const dictionaryCacheHit = vi.fn();
    const dictionaryCacheMiss = vi.fn();

    manager.subscribe('locales-dictionary-cache-miss', localesDictionaryMiss);
    manager.subscribe('locales-dictionary-cache-hit', localesDictionaryHit);
    manager.subscribe('dictionary-cache-hit', dictionaryCacheHit);
    manager.subscribe('dictionary-cache-miss', dictionaryCacheMiss);

    await manager.loadDictionary('fr');
    await manager.loadDictionary('fr');

    expect(localesDictionaryMiss).toHaveBeenCalledWith({
      locale: 'fr',
      dictionary: {
        greeting: 'Bonjour',
      },
    });
    expect(localesDictionaryHit).toHaveBeenCalledWith({
      locale: 'fr',
      dictionary: {
        greeting: 'Bonjour',
      },
    });
    expect(dictionaryCacheHit).not.toHaveBeenCalled();
    expect(dictionaryCacheMiss).not.toHaveBeenCalled();
  });
});
