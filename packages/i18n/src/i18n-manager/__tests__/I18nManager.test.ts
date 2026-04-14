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
    manager.setLocale('fr');

    // Load translations first
    await manager.loadTranslations('fr');

    // Now sync resolution should work
    const result = manager.resolveTranslationSync(message, lookupOptions);
    expect(result).toBe(translatedString);
  });

  it('getTranslations returns empty object for invalid locale', async () => {
    const manager = createManager();

    const result = await manager.getTranslations('zh');
    expect(result).toEqual({});
  });

  it('getTranslationResolver returns a working resolver function', async () => {
    const manager = createManager();
    manager.setLocale('fr');

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

  it('lookupTranslation() returns undefined before load, translation after', async () => {
    const manager = createManager();
    manager.setLocale('fr');

    // Before loading
    const before = manager.lookupTranslation(message, lookupOptions);
    expect(before).toBeUndefined();

    // Load translations
    await manager.loadTranslations('fr');

    // After loading
    const after = manager.lookupTranslation(message, lookupOptions);
    expect(after).toBe(translatedString);
  });

  it('lookupTranslationWithFallback() falls back to runtime translate on cache miss', async () => {
    const unknownMessage = 'Unknown message';
    const unknownOptions: LookupOptions = { $format: 'ICU' };
    const unknownHash = hashMessage(unknownMessage, unknownOptions);

    // loadTranslations returns translations that do NOT include unknownMessage
    const manager = createManager();
    manager.setLocale('fr');

    // Mock translateMany to return a translation for the unknown message
    mockTranslateMany.mockResolvedValue({
      [unknownHash]: {
        success: true,
        translation: 'Message inconnu',
      },
    });

    const result = await manager.lookupTranslationWithFallback(
      unknownMessage,
      unknownOptions
    );

    expect(result).toBe('Message inconnu');
    expect(mockTranslateMany).toHaveBeenCalled();
  });
});
