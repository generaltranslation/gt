import { afterEach, describe, expect, it, vi } from 'vitest';
import { I18nCache } from '../../i18n-cache/I18nCache';
import { setI18nCache } from '../../i18n-cache/singleton-operations';
import type { I18nCacheConstructorParams } from '../../i18n-cache/types';
import { setWritableConditionStore } from '../../condition-store/singleton-operations';
import { initializeI18nConfig } from '../../i18n-config/singleton-operations';
import type { I18nConfigParams } from '../../i18n-config/I18nConfig';
import {
  getDefaultLocale,
  getLocale,
  getLocaleProperties,
  getLocales,
} from '../../helpers/locale';
import { hashMessage } from '../../utils/hashMessage';
import { t } from '../t';

describe('t', () => {
  function createCache(
    i18nConfig: I18nConfigParams,
    cacheConfig: I18nCacheConstructorParams = {}
  ) {
    initializeI18nConfig(i18nConfig);
    return new I18nCache(cacheConfig);
  }

  afterEach(() => {
    setWritableConditionStore({ getLocale: () => 'en' });
  });

  it('works without an explicit locale', () => {
    setWritableConditionStore({ getLocale: () => 'en' });
    setI18nCache(
      createCache(
        { defaultLocale: 'en', locales: ['en', 'fr'] },
        {
          loadTranslations: vi.fn(),
        }
      )
    );

    expect(t('Hello')).toBe('Hello');
  });

  it('uses the configured fallback locale store when no locale is provided', async () => {
    const message = 'Hello {name}!';
    const translatedMessage = 'Bonjour {name} !';
    const cache = createCache(
      { defaultLocale: 'en', locales: ['en', 'fr'] },
      {
        loadTranslations: vi.fn().mockResolvedValue({
          [hashMessage(message, { $format: 'ICU' })]: translatedMessage,
        }),
      }
    );
    const conditionStore = { getLocale: () => 'fr' };

    setI18nCache(cache);
    setWritableConditionStore(conditionStore);
    await cache.loadTranslations('fr');

    expect(t(message, { name: 'Alice' })).toBe('Bonjour Alice !');
  });

  it('allows an explicit $locale to override the current locale', async () => {
    const message = 'Hello {name}!';
    const cache = createCache(
      { defaultLocale: 'en', locales: ['en', 'fr', 'es'] },
      {
        loadTranslations: vi.fn().mockImplementation((locale: string) => ({
          [hashMessage(message, { $format: 'ICU' })]:
            locale === 'es' ? 'Hola {name}!' : 'Bonjour {name} !',
        })),
      }
    );

    setI18nCache(cache);
    setWritableConditionStore({ getLocale: () => 'fr' });
    await cache.loadTranslations('es');

    expect(t(message, { $locale: 'es', name: 'Alice' })).toBe('Hola Alice!');
  });

  it('does not read the current locale when $locale is explicit', async () => {
    const message = 'Hello {name}!';
    const cache = createCache(
      { defaultLocale: 'en', locales: ['en', 'fr'] },
      {
        loadTranslations: vi.fn().mockResolvedValue({
          [hashMessage(message, { $format: 'ICU' })]: 'Bonjour {name} !',
        }),
      }
    );

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
      createCache(
        { defaultLocale: 'es', locales: ['es'] },
        { loadTranslations: vi.fn() }
      )
    );

    expect(getLocale()).toBe('fr');
  });

  it('returns locale properties outside configured translation locales', () => {
    setI18nCache(
      createCache(
        { defaultLocale: 'en', locales: ['fr'] },
        { loadTranslations: vi.fn() }
      )
    );

    expect(getLocaleProperties('de-DE').code).toBe('de-DE');
  });

  it('exposes configured locale helper values', () => {
    setI18nCache(
      createCache(
        {
          defaultLocale: 'en-US',
          locales: ['en-US', 'fr', 'brand-french'],
          customMapping: {
            'brand-french': {
              code: 'fr',
              name: 'Brand French',
            },
          },
        },
        { loadTranslations: vi.fn() }
      )
    );

    expect(getDefaultLocale()).toBe('en-US');
    expect(getLocales()).toEqual(['en-US', 'fr', 'brand-french']);
    expect(getLocaleProperties('brand-french')).toMatchObject({
      code: 'fr',
      name: 'Brand French',
    });
  });
});
