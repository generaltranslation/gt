import { afterEach, describe, expect, it, vi } from 'vitest';
import { I18nManager } from '../../../i18n-manager/I18nManager';
import {
  setConditionStore,
  setI18nManager,
} from '../../../i18n-manager/singleton-operations';
import { msg } from '../../msg';
import { hashMessage } from '../../../utils/hashMessage';
import { getGT } from '../getGT';
import { getTranslations } from '../getTranslations';
import { getMessages } from '../getMessages';
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

  it('getTranslations uses the current locale for dictionary entries', async () => {
    const manager = new I18nManager({
      defaultLocale: 'en',
      locales: ['en', 'fr'],
      dictionary: {
        greeting: 'Hello {name}!',
      },
      loadDictionary: vi.fn().mockResolvedValue({
        greeting: 'Bonjour {name} !',
      }),
    });
    setI18nManager(manager);
    setConditionStore({ getLocale: () => 'fr' });

    const t = await getTranslations();

    expect(t('greeting', { name: 'Alice' })).toBe('Bonjour Alice !');
  });

  it('getTranslations returns source dictionary entries when no target translation exists', async () => {
    const manager = new I18nManager({
      defaultLocale: 'en',
      locales: ['en', 'fr'],
      dictionary: {
        greeting: 'Hello {name}!',
      },
      loadDictionary: vi.fn().mockResolvedValue({}),
    });
    setI18nManager(manager);
    setConditionStore({ getLocale: () => 'fr' });

    const t = await getTranslations();

    expect(t('greeting', { name: 'Alice' })).toBe('Hello Alice!');
  });

  it('getTranslations obj returns translated dictionary subtrees', async () => {
    const manager = new I18nManager({
      defaultLocale: 'en',
      locales: ['en', 'fr'],
      dictionary: {
        user: {
          profile: {
            name: 'Name',
            greeting: 'Hello {name}!',
          },
        },
      },
      loadDictionary: vi.fn().mockResolvedValue({
        user: {
          profile: {
            name: 'Nom',
            greeting: 'Bonjour {name} !',
          },
        },
      }),
    });
    setI18nManager(manager);
    setConditionStore({ getLocale: () => 'fr' });

    const t = await getTranslations();

    expect(t.obj('user.profile', { name: 'Alice' })).toEqual({
      name: 'Nom',
      greeting: 'Bonjour Alice !',
    });
  });

  it('getMessages uses the current locale without accepting a locale parameter', async () => {
    const message = 'Hello {name}!';
    setupManager({
      [hashMessage(message, { $format: 'ICU' })]: 'Bonjour {name} !',
    });

    const m = await getMessages();

    expect(m(msg(message, { name: 'Alice' }))).toBe('Bonjour Alice !');
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
