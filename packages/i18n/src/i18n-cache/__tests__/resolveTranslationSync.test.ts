import { describe, it, expect, vi, beforeEach } from 'vitest';
import { I18nCache } from '../I18nCache';
import { hashMessage } from '../../utils/hashMessage';

describe('I18nCache.resolveTranslationSync', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return undefined when no translations loaded for locale', () => {
    const cache = new I18nCache({
      defaultLocale: 'en',
      locales: ['en', 'fr'],
      loadTranslations: vi.fn(),
    });

    const result = cache.resolveTranslationSync('fr', 'Hello', {
      $format: 'ICU',
    });

    expect(result).toBeUndefined();
  });

  it('does not throw without options in development', () => {
    const cache = new I18nCache({
      defaultLocale: 'en',
      locales: ['en', 'fr'],
      loadTranslations: vi.fn(),
      environment: 'development',
    });

    const options = { $format: 'ICU' as const };

    expect(() =>
      cache.resolveTranslationSync('fr', 'Hello', options)
    ).not.toThrow();
    expect(
      cache.resolveTranslationSync('fr', 'Hello', options)
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

    const cache = new I18nCache({
      defaultLocale: 'en',
      locales: ['en', 'fr'],
      loadTranslations: vi.fn().mockResolvedValue(mockTranslations),
    });

    // Trigger async load to populate resolvedCache
    await cache.getTranslations('fr');

    const result = cache.resolveTranslationSync('fr', message, options);

    expect(result).toBe(translatedString);
  });
});
