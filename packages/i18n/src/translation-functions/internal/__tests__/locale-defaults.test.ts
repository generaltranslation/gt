import { afterEach, describe, expect, it, vi } from 'vitest';
import { I18nManager } from '../../../i18n-manager/I18nManager';
import {
  setConditionStore,
  setI18nManager,
} from '../../../i18n-manager/singleton-operations';
import { msg } from '../../msg';
import { hashMessage } from '../../../utils/hashMessage';
import { getGT } from '../getGT';
import { getMessages } from '../getMessages';
import { getTranslations } from '../getTranslations';
import { tx } from '../tx';

describe('translation function locale defaults', () => {
  afterEach(() => {
    setConditionStore({ getLocale: () => 'en' });
  });

  function setupManager(translations: Record<string, string>) {
    const manager = new I18nManager({
      defaultLocale: 'en',
      locales: ['en', 'fr'],
      loadTranslations: vi.fn().mockResolvedValue(translations),
    });

    setI18nManager(manager);
    setConditionStore({ getLocale: () => 'fr' });

    return manager;
  }

  it('getGT uses the current locale without accepting a locale parameter', async () => {
    const message = 'Hello {name}!';
    setupManager({
      [hashMessage(message, { $format: 'ICU' })]: 'Bonjour {name} !',
    });

    const gt = await getGT();

    expect(gt(message, { name: 'Alice' })).toBe('Bonjour Alice !');
  });

  it('getGT allows $locale to select another loaded locale', async () => {
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

    const gt = await getGT();
    await manager.loadTranslations('es');

    expect(gt(message, { $locale: 'es', name: 'Alice' })).toBe('Hola Alice!');
  });

  it('getMessages uses the current locale without accepting a locale parameter', async () => {
    const message = 'Hello {name}!';
    setupManager({
      [hashMessage(message, { $format: 'ICU' })]: 'Bonjour {name} !',
    });

    const m = await getMessages();

    expect(m(msg(message, { name: 'Alice' }))).toBe('Bonjour Alice !');
  });

  it('getTranslations uses the current locale without accepting a locale parameter', async () => {
    const loadDictionary = vi.fn().mockResolvedValue({
      greeting: 'Bonjour {name} !',
    });
    const manager = new I18nManager({
      defaultLocale: 'en',
      locales: ['en', 'fr'],
      dictionary: {
        greeting: 'Hello {name}!',
      },
      loadDictionary,
      loadTranslations: vi.fn().mockResolvedValue({}),
    });
    setI18nManager(manager);
    setConditionStore({ getLocale: () => 'fr' });

    const t = await getTranslations();

    expect(t('greeting', { name: 'Alice' })).toBe('Bonjour Alice !');
    expect(loadDictionary).toHaveBeenCalledWith('fr');
  });

  it('getTranslations ignores $locale and uses the current locale', async () => {
    const loadDictionary = vi.fn().mockImplementation((locale: string) =>
      Promise.resolve({
        greeting: locale === 'es' ? 'Hola {name}!' : 'Bonjour {name} !',
      })
    );
    const manager = new I18nManager({
      defaultLocale: 'en',
      locales: ['en', 'fr', 'es'],
      dictionary: {
        greeting: 'Hello {name}!',
      },
      loadDictionary,
      loadTranslations: vi.fn().mockResolvedValue({}),
    });
    setI18nManager(manager);
    setConditionStore({ getLocale: () => 'fr' });

    const t = await getTranslations();
    await manager.loadDictionary('es');

    expect(t('greeting', { $locale: 'es', name: 'Alice' })).toBe(
      'Bonjour Alice !'
    );
  });

  it('getTranslations returns an empty string for missing dictionary entries', async () => {
    const manager = new I18nManager({
      defaultLocale: 'en',
      locales: ['en', 'fr'],
      dictionary: {},
      loadDictionary: vi.fn().mockResolvedValue({}),
      loadTranslations: vi.fn().mockResolvedValue({}),
    });
    setI18nManager(manager);
    setConditionStore({ getLocale: () => 'fr' });

    const t = await getTranslations();

    expect(t('missing')).toBe('');
  });

  it('getTranslations returns an empty string when only the target locale has an entry', async () => {
    const manager = new I18nManager({
      defaultLocale: 'en',
      locales: ['en', 'fr'],
      dictionary: {},
      loadDictionary: vi.fn().mockResolvedValue({
        stale: 'Bonjour',
      }),
      loadTranslations: vi.fn().mockResolvedValue({}),
    });
    setI18nManager(manager);
    setConditionStore({ getLocale: () => 'fr' });

    const t = await getTranslations();

    expect(t('stale')).toBe('');
  });

  it('getTranslations ignores dictionary metadata options during interpolation', async () => {
    const manager = new I18nManager({
      defaultLocale: 'en',
      locales: ['en', 'fr'],
      dictionary: {
        greeting: 'Hello {name}!',
      },
      loadDictionary: vi.fn().mockResolvedValue({
        greeting: 'Bonjour {name} !',
      }),
      loadTranslations: vi.fn().mockResolvedValue({}),
    });
    setI18nManager(manager);
    setConditionStore({ getLocale: () => 'fr' });

    const t = await getTranslations();

    expect(
      t('greeting', {
        name: 'Alice',
        $context: 'ignored',
        $maxChars: 7,
      } as unknown as Parameters<typeof t>[1])
    ).toBe('Bonjour Alice !');
  });

  it('tx uses the current locale when $locale is omitted', async () => {
    const message = 'Hello';
    setupManager({
      [hashMessage(message, { $format: 'STRING' })]: 'Bonjour',
    });

    await expect(tx(message)).resolves.toBe('Bonjour');
  });

  it('tx does not read the current locale when $locale is explicit', async () => {
    const message = 'Hello';
    const manager = new I18nManager({
      defaultLocale: 'en',
      locales: ['en', 'fr'],
      loadTranslations: vi.fn().mockResolvedValue({
        [hashMessage(message, { $format: 'STRING' })]: 'Bonjour',
      }),
    });

    setI18nManager(manager);
    setConditionStore({
      getLocale: () => {
        throw new Error('current locale should not be read');
      },
    });

    await expect(tx(message, { $locale: 'fr' })).resolves.toBe('Bonjour');
  });
});
