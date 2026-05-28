import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { I18nCache } from '../I18nCache';
import { hashMessage } from '../../utils/hashMessage';
import { initializeI18nConfig } from '../../i18n-config/singleton-operations';

describe('I18nCache.resolveTranslationSync', () => {
  beforeEach(() => {
    initializeI18nConfig({
      defaultLocale: 'en',
      locales: ['en', 'fr'],
    });
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('should return undefined when no translations loaded for locale', () => {
    const cache = new I18nCache({
      loadTranslations: vi.fn(),
    });

    const result = cache.resolveTranslationSync('fr', 'Hello', {
      $format: 'ICU',
    });

    expect(result).toBeUndefined();
  });

  it('does not throw without options in development', () => {
    vi.stubEnv('NODE_ENV', 'development');

    const cache = new I18nCache({
      loadTranslations: vi.fn(),
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
      loadTranslations: vi.fn().mockResolvedValue(mockTranslations),
    });

    // Trigger async load to populate resolvedCache
    await cache.getTranslations('fr');

    const result = cache.resolveTranslationSync('fr', message, options);

    expect(result).toBe(translatedString);
  });
});
