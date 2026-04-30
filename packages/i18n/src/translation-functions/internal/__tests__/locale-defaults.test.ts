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

  it('tx uses the current locale when $locale is omitted', async () => {
    const message = 'Hello';
    setupManager({
      [hashMessage(message, { $format: 'STRING' })]: 'Bonjour',
    });

    await expect(tx(message)).resolves.toBe('Bonjour');
  });
});
