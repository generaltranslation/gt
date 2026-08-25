import { beforeEach, describe, expect, it, vi } from 'vitest';
import { hashMessage, initializeI18nConfig } from 'gt-i18n/internal';
import type { LookupOptions } from 'gt-i18n/internal/types';
import { ReactI18nCache } from '../../i18n-cache/ReactI18nCache';
import { createResolveMissing } from '../../i18n-cache/createResolveMissing';
import { setReactI18nCache } from '../../i18n-cache/singleton-operations';
import { I18nStore } from '../I18nStore';

const options: LookupOptions = { $format: 'ICU' };

type TestGlobal = typeof globalThis & {
  __generaltranslation?: unknown;
};

describe('I18nStore compatibility adapter', () => {
  let cache: ReactI18nCache;
  let store: I18nStore;

  beforeEach(() => {
    Reflect.deleteProperty(globalThis as TestGlobal, '__generaltranslation');
    initializeI18nConfig({ defaultLocale: 'en', locales: ['en', 'fr'] });
    cache = new ReactI18nCache(
      {
        loadTranslations: vi.fn().mockResolvedValue({}),
      },
      {
        createResolveMissing,
      }
    );
    setReactI18nCache(cache);
    store = new I18nStore();
  });

  it('delegates translation and preserves the legacy event shape', async () => {
    vi.spyOn(cache, 'lookupTranslationWithFallback').mockResolvedValue(
      'Bonjour'
    );
    const lookup = { locale: 'fr', message: 'Hello', options };
    const listener = vi.fn();
    store.subscribeToTranslationEvents(listener);

    await store.translate(lookup);

    expect(listener).toHaveBeenCalledWith(lookup);
  });

  it('keeps lookup-specific translation subscriptions', async () => {
    vi.spyOn(cache, 'lookupTranslationWithFallback').mockResolvedValue(
      'Bonjour'
    );
    const listener = vi.fn();
    store.subscribeToTranslate(
      { locale: 'fr', message: 'Hello', options },
      listener
    );

    await store.translate({ locale: 'fr', message: 'Goodbye', options });
    await store.translate({ locale: 'fr', message: 'Hello', options });

    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('notifies both legacy dictionary subscription channels', async () => {
    vi.spyOn(cache, 'lookupDictionaryWithFallback').mockResolvedValue({
      entry: 'Bonjour',
      options: {},
    });
    const entryListener = vi.fn();
    const objectListener = vi.fn();
    store.subscribeToDictionaryEntryEvents(entryListener);
    store.subscribeToDictionaryObjectEvents(objectListener);

    store.translateDictionaryEntry({ locale: 'fr', id: 'greeting' });

    await vi.waitFor(() => expect(entryListener).toHaveBeenCalledOnce());
    expect(entryListener).toHaveBeenCalledWith({
      locale: 'fr',
      id: 'greeting',
    });
    expect(objectListener).toHaveBeenCalledWith({
      locale: 'fr',
      id: 'greeting',
    });
  });

  it('reads provider snapshots before the cache', () => {
    const lookup = { locale: 'fr', message: 'Hello', options };
    const hash = hashMessage(lookup.message, lookup.options);
    vi.spyOn(cache, 'lookupTranslation').mockReturnValue('cache value');

    expect(
      store.getTranslateSnapshot(lookup, {
        fr: { [hash]: 'provider value' },
      })
    ).toBe('provider value');
  });
});
