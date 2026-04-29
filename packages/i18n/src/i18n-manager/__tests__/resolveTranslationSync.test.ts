import { describe, it, expect, vi, beforeEach } from 'vitest';
import { I18nManager } from '../I18nManager';
import { hashMessage } from '../../utils/hashMessage';

describe('I18nManager.resolveTranslationSync', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return undefined when no translations loaded for locale', () => {
    const manager = new I18nManager({
      defaultLocale: 'en',
      locales: ['en', 'fr'],
      loadTranslations: vi.fn(),
    });

    const result = manager.resolveTranslationSync('fr', 'Hello', {
      $format: 'ICU',
    });

    expect(result).toBeUndefined();
  });

  it('does not throw without options in development', () => {
    const manager = new I18nManager({
      defaultLocale: 'en',
      locales: ['en', 'fr'],
      loadTranslations: vi.fn(),
      environment: 'development',
    });

    const options = { $format: 'ICU' as const };

    expect(() =>
      manager.resolveTranslationSync('fr', 'Hello', options)
    ).not.toThrow();
    expect(
      manager.resolveTranslationSync('fr', 'Hello', options)
    ).toBeUndefined();
  });

  it('should return the correct translation via hash lookup after async getTranslations populates resolvedCache', async () => {
    const message = 'Hello {name}!';
    const options = { $context: 'greeting' };
    const expectedHash = hashMessage(message, options);
    const translatedString = 'Bonjour {name} !';

    const mockTranslations = {
      [expectedHash]: translatedString,
    };

    const manager = new I18nManager({
      defaultLocale: 'en',
      locales: ['en', 'fr'],
      loadTranslations: vi.fn().mockResolvedValue(mockTranslations),
    });

    // Trigger async load to populate resolvedCache
    await manager.getTranslations('fr');

    const result = manager.resolveTranslationSync('fr', message, options);

    expect(result).toBe(translatedString);
  });
});
