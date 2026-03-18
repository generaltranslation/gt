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
    manager.setLocale('fr');

    const result = manager.resolveTranslationSync('Hello');

    expect(result).toBeUndefined();
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
    manager.setLocale('fr');

    // Trigger async load to populate resolvedCache
    await manager.getTranslations('fr');

    const result = manager.resolveTranslationSync(message, options);

    expect(result).toBe(translatedString);
  });
});
