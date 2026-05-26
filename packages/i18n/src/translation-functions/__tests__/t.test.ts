import { afterEach, describe, expect, it, vi } from 'vitest';
import { I18nCache } from '../../i18n-cache/I18nCache';
import { setI18nCache } from '../../i18n-cache/singleton-operations';
import { setWritableConditionStore } from '../../condition-store/singleton-operations';
import { getLocale, getLocaleProperties } from '../../helpers/locale';
import { hashMessage } from '../../utils/hashMessage';
import { t } from '../t';

describe('t', () => {
  afterEach(() => {
    setWritableConditionStore({ getLocale: () => 'en' });
  });

  it('works without an explicit locale', () => {
    setWritableConditionStore({ getLocale: () => 'en' });
    setI18nCache(
      new I18nCache({
        defaultLocale: 'en',
        locales: ['en', 'fr'],
        loadTranslations: vi.fn(),
      })
    );

    expect(t('Hello')).toBe('Hello');
  });

  it('uses the configured fallback locale store when no locale is provided', async () => {
    const message = 'Hello {name}!';
    const translatedMessage = 'Bonjour {name} !';
    const cache = new I18nCache({
      defaultLocale: 'en',
      locales: ['en', 'fr'],
      loadTranslations: vi.fn().mockResolvedValue({
        [hashMessage(message, { $format: 'ICU' })]: translatedMessage,
      }),
    });
    const conditionStore = { getLocale: () => 'fr' };

    setI18nCache(cache);
    setWritableConditionStore(conditionStore);
    await cache.loadTranslations('fr');

    expect(t(message, { name: 'Alice' })).toBe('Bonjour Alice !');
  });

  it('allows an explicit $locale to override the current locale', async () => {
    const message = 'Hello {name}!';
    const cache = new I18nCache({
      defaultLocale: 'en',
      locales: ['en', 'fr', 'es'],
      loadTranslations: vi.fn().mockImplementation((locale: string) => ({
        [hashMessage(message, { $format: 'ICU' })]:
          locale === 'es' ? 'Hola {name}!' : 'Bonjour {name} !',
      })),
    });

    setI18nCache(cache);
    setWritableConditionStore({ getLocale: () => 'fr' });
    await cache.loadTranslations('es');

    expect(t(message, { $locale: 'es', name: 'Alice' })).toBe('Hola Alice!');
  });

  it('does not read the current locale when $locale is explicit', async () => {
    const message = 'Hello {name}!';
    const cache = new I18nCache({
      defaultLocale: 'en',
      locales: ['en', 'fr'],
      loadTranslations: vi.fn().mockResolvedValue({
        [hashMessage(message, { $format: 'ICU' })]: 'Bonjour {name} !',
      }),
    });

    setI18nCache(cache);
    setWritableConditionStore({
      getLocale: () => {
        throw new Error('current locale should not be read');
      },
    });
    await cache.loadTranslations('fr');

    expect(t(message, { $locale: 'fr', name: 'Alice' })).toBe(
      'Bonjour Alice !'
    );
  });

  it('keeps the configured condition store when the singleton cache is replaced', () => {
    setWritableConditionStore({ getLocale: () => 'fr' });

    setI18nCache(
      new I18nCache({
        defaultLocale: 'es',
        locales: ['es'],
        loadTranslations: vi.fn(),
      })
    );

    expect(getLocale()).toBe('fr');
  });

  it('returns locale properties outside configured translation locales', () => {
    setI18nCache(
      new I18nCache({
        defaultLocale: 'en',
        locales: ['fr'],
        loadTranslations: vi.fn(),
      })
    );

    expect(getLocaleProperties('de-DE').code).toBe('de-DE');
  });
});
