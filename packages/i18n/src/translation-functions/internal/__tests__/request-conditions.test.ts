import { describe, expect, it, vi } from 'vitest';
import { I18nCache } from '../../../i18n-cache/I18nCache';
import type { I18nCacheConstructorParams } from '../../../i18n-cache/types';
import { setI18nCache } from '../../../i18n-cache/singleton-operations';
import { setWritableConditionStore } from '../../../condition-store/singleton-operations';
import { initializeI18nConfig } from '../../../i18n-config/singleton-operations';
import { hashMessage } from '../../../utils/hashMessage';
import { getGT, getGTInternal } from '../getGT';
import { getMessagesInternal } from '../getMessages';
import { getTranslationsInternal } from '../getTranslations';
import { msg } from '../../msg';

function setupCache(cacheConfig: I18nCacheConstructorParams = {}) {
  initializeI18nConfig({ defaultLocale: 'en', locales: ['en', 'fr'] });
  const cache = new I18nCache(cacheConfig);
  setI18nCache(cache);
  return cache;
}

describe('internal translation functions with explicit request conditions', () => {
  it('getGTInternal resolves translations for the given locale without a condition store', async () => {
    const message = 'Hello {name}!';
    setupCache({
      loadTranslations: vi.fn().mockResolvedValue({
        [hashMessage(message, { $format: 'ICU' })]: 'Bonjour {name} !',
      }),
    });

    const gt = await getGTInternal({ locale: 'fr' });

    expect(gt(message, { name: 'Alice' })).toBe('Bonjour Alice !');
  });

  it('getGTInternal renders the source when i18n is disabled', async () => {
    const message = 'Hello {name}!';
    const loadTranslations = vi.fn().mockResolvedValue({
      [hashMessage(message, { $format: 'ICU' })]: 'Bonjour {name} !',
    });
    setupCache({ loadTranslations });

    const gt = await getGTInternal({ locale: 'fr', enableI18n: false });

    expect(gt(message, { name: 'Alice' })).toBe('Hello Alice!');
    expect(loadTranslations).not.toHaveBeenCalled();
  });

  it('getMessagesInternal resolves registered messages for the given locale', async () => {
    const message = 'Hello {name}!';
    setupCache({
      loadTranslations: vi.fn().mockResolvedValue({
        [hashMessage(message, { $format: 'ICU' })]: 'Bonjour {name} !',
      }),
    });

    const m = await getMessagesInternal({ locale: 'fr' });

    expect(m(msg(message), { name: 'Alice' })).toBe('Bonjour Alice !');
  });

  it('getTranslationsInternal resolves dictionary entries for the given locale', async () => {
    setupCache({
      dictionary: { greeting: 'Hello {name}!' },
      loadDictionary: vi.fn().mockResolvedValue({
        greeting: 'Bonjour {name} !',
      }),
      loadTranslations: vi.fn().mockResolvedValue({}),
    });

    const t = await getTranslationsInternal({ locale: 'fr' });

    expect(t('greeting', { name: 'Alice' })).toBe('Bonjour Alice !');
  });

  it('getTranslationsInternal renders the source dictionary when i18n is disabled', async () => {
    const loadDictionary = vi.fn().mockResolvedValue({
      greeting: 'Bonjour {name} !',
    });
    setupCache({
      dictionary: { greeting: 'Hello {name}!', menu: { open: 'Open' } },
      loadDictionary,
    });

    const t = await getTranslationsInternal({
      locale: 'fr',
      enableI18n: false,
    });

    expect(t('greeting', { name: 'Alice' })).toBe('Hello Alice!');
    expect(t.obj('menu')).toEqual({ open: 'Open' });
    expect(loadDictionary).not.toHaveBeenCalled();
  });

  it('getGT reads enableI18n from the condition store', async () => {
    const message = 'Hello {name}!';
    setupCache({
      loadTranslations: vi.fn().mockResolvedValue({
        [hashMessage(message, { $format: 'ICU' })]: 'Bonjour {name} !',
      }),
    });
    setWritableConditionStore({
      getLocale: () => 'fr',
      getEnableI18n: () => false,
    } as Parameters<typeof setWritableConditionStore>[0]);

    const gt = await getGT();

    expect(gt(message, { name: 'Alice' })).toBe('Hello Alice!');
  });
});
