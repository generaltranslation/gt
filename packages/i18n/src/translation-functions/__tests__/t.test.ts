import { afterEach, describe, expect, it, vi } from 'vitest';
import { I18nManager } from '../../i18n-manager/I18nManager';
import {
  setI18nManager,
  setConditionStore,
} from '../../i18n-manager/singleton-operations';
import { getLocale, getLocaleProperties } from '../../helpers/locale';
import { hashMessage } from '../../utils/hashMessage';
import { t } from '../t';

describe('t', () => {
  afterEach(() => {
    setConditionStore({ getLocale: () => 'en' });
  });

  it('works without an explicit locale', () => {
    setI18nManager(
      new I18nManager({
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
    const manager = new I18nManager({
      defaultLocale: 'en',
      locales: ['en', 'fr'],
      loadTranslations: vi.fn().mockResolvedValue({
        [hashMessage(message, { $format: 'ICU' })]: translatedMessage,
      }),
    });
    const conditionStore = { getLocale: () => 'fr' };

    setI18nManager(manager);
    setConditionStore(conditionStore);
    await manager.loadTranslations('fr');

    expect(t(message, { name: 'Alice' })).toBe('Bonjour Alice !');
  });

  it('allows an explicit $locale to override the current locale', async () => {
    const message = 'Hello {name}!';
    const manager = new I18nManager({
      defaultLocale: 'en',
      locales: ['en', 'fr', 'es'],
      loadTranslations: vi.fn().mockImplementation((locale: string) => ({
        [hashMessage(message, { $format: 'ICU' })]:
          locale === 'es' ? 'Hola {name}!' : 'Bonjour {name} !',
      })),
    });

    setI18nManager(manager);
    setConditionStore({ getLocale: () => 'fr' });
    await manager.loadTranslations('es');

    expect(t(message, { $locale: 'es', name: 'Alice' })).toBe('Hola Alice!');
  });

  it('resets stale condition stores when the singleton manager is replaced', () => {
    setConditionStore({ getLocale: () => 'fr' });

    setI18nManager(
      new I18nManager({
        defaultLocale: 'es',
        locales: ['es'],
        loadTranslations: vi.fn(),
      })
    );

    expect(getLocale()).toBe('es');
  });

  it('returns locale properties outside configured translation locales', () => {
    setI18nManager(
      new I18nManager({
        defaultLocale: 'en',
        locales: ['fr'],
        loadTranslations: vi.fn(),
      })
    );

    expect(getLocaleProperties('de-DE').code).toBe('de-DE');
  });
});
