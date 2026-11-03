import { beforeEach, describe, expect, it, vi } from 'vitest';
import { hashMessage, initializeI18nConfig } from 'gt-i18n/internal';
import { setReactI18nCache } from '../../i18n-cache/singleton-operations';
import { I18nStore } from '../I18nStore';
import { ReactI18nCache } from '../../i18n-cache/ReactI18nCache';
import type { TranslateLookup } from '../storeTypes';

type TestGlobal = typeof globalThis & {
  __generaltranslation?: unknown;
};

function resetGTGlobals() {
  Reflect.deleteProperty(globalThis as TestGlobal, '__generaltranslation');
}

const lookupTranslationWithFallback = vi.fn();
const lookupDictionaryWithFallback = vi.fn();
const lookupDictionaryObjWithFallback = vi.fn();

function setup() {
  initializeI18nConfig({
    defaultLocale: 'en',
    locales: ['en', 'fr'],
  });
  setReactI18nCache({
    lookupTranslationWithFallback,
    lookupDictionaryWithFallback,
    lookupDictionaryObjWithFallback,
  } as unknown as ReactI18nCache);
}

// In development the cache rejects when the runtime API rejects the request
// (for example a 401 from an invalid dev API key). SSR fires these store
// methods without awaiting them, so a rejection here used to become an
// unhandled rejection that killed the dev server.
const rejectedKeyError = new Error(
  'Remote translation request failed: 401 Invalid API key'
);

const lookup: TranslateLookup = {
  locale: 'fr',
  message: 'Hello',
  options: { $format: 'ICU' },
};

describe('I18nStore runtime translation failure handling', () => {
  let consoleError: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    resetGTGlobals();
    vi.clearAllMocks();
    setup();
    consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  it('translate() resolves and logs when the runtime request is rejected', async () => {
    lookupTranslationWithFallback.mockRejectedValue(rejectedKeyError);
    const store = new I18nStore();

    await expect(store.translate(lookup)).resolves.toBeUndefined();

    expect(consoleError).toHaveBeenCalledTimes(1);
    expect(consoleError).toHaveBeenCalledWith(
      expect.stringContaining('401 Invalid API key')
    );
  });

  it('translate() does not emit a translate event for a failed request', async () => {
    lookupTranslationWithFallback.mockRejectedValue(rejectedKeyError);
    const store = new I18nStore();
    const listener = vi.fn();
    store.subscribeToTranslationEvents(listener);

    await store.translate(lookup);

    expect(listener).not.toHaveBeenCalled();
  });

  it('translate() logs an identical failure once across lookups', async () => {
    lookupTranslationWithFallback.mockRejectedValue(rejectedKeyError);
    const store = new I18nStore();

    await store.translate(lookup);
    await store.translate({ ...lookup, message: 'Goodbye' });

    expect(consoleError).toHaveBeenCalledTimes(1);
  });

  it('translateDictionaryEntry() logs instead of leaving an unhandled rejection', async () => {
    lookupDictionaryWithFallback.mockRejectedValue(rejectedKeyError);
    const store = new I18nStore();

    store.translateDictionaryEntry({ locale: 'fr', id: 'greeting' });

    await vi.waitFor(() => expect(consoleError).toHaveBeenCalledTimes(1));
  });

  it('re-logs a failure after it is evicted from the bounded dedupe set', async () => {
    const store = new I18nStore();
    for (let i = 0; i <= 100; i++) {
      lookupTranslationWithFallback.mockRejectedValueOnce(
        new Error(`failure ${i}`)
      );
      await store.translate({ ...lookup, message: `message ${i}` });
    }
    expect(consoleError).toHaveBeenCalledTimes(101);

    lookupTranslationWithFallback.mockRejectedValueOnce(new Error('failure 0'));
    await store.translate(lookup);

    expect(consoleError).toHaveBeenCalledTimes(102);
  });

  it('logs distinct non-Error rejection reasons separately', async () => {
    const store = new I18nStore();

    lookupTranslationWithFallback.mockRejectedValueOnce({ code: 'A' });
    await store.translate({ ...lookup, message: 'm1' });
    lookupTranslationWithFallback.mockRejectedValueOnce({ code: 'B' });
    await store.translate({ ...lookup, message: 'm2' });
    expect(consoleError).toHaveBeenCalledTimes(2);

    lookupTranslationWithFallback.mockRejectedValueOnce(null);
    await store.translate({ ...lookup, message: 'm3' });
    lookupTranslationWithFallback.mockRejectedValueOnce(undefined);
    await store.translate({ ...lookup, message: 'm4' });
    expect(consoleError).toHaveBeenCalledTimes(4);

    lookupTranslationWithFallback.mockRejectedValueOnce({ code: 'A' });
    await store.translate({ ...lookup, message: 'm5' });
    expect(consoleError).toHaveBeenCalledTimes(4);
  });

  it('translateDictionaryObject() logs instead of leaving an unhandled rejection', async () => {
    lookupDictionaryObjWithFallback.mockRejectedValue(rejectedKeyError);
    const store = new I18nStore();

    store.translateDictionaryObject({ locale: 'fr', id: 'nav' });

    await vi.waitFor(() => expect(consoleError).toHaveBeenCalledTimes(1));
  });
});

describe('I18nStore translation snapshots', () => {
  beforeEach(resetGTGlobals);

  it('reads a dialect lookup from the catalog the cache would use', () => {
    initializeI18nConfig({ defaultLocale: 'en', locales: ['en', 'fr'] });
    setReactI18nCache(
      new ReactI18nCache({ loadTranslations: async () => ({}) })
    );
    const hash = hashMessage(lookup.message, lookup.options);

    expect(
      new I18nStore().getTranslateSnapshot(
        { ...lookup, locale: 'fr-FR' },
        { fr: { [hash]: 'Bonjour' } }
      )
    ).toBe('Bonjour');
  });

  it('still reads a snapshot keyed by the raw lookup locale', () => {
    initializeI18nConfig({ defaultLocale: 'en', locales: ['en', 'fr'] });
    setReactI18nCache(
      new ReactI18nCache({ loadTranslations: async () => ({}) })
    );
    const hash = hashMessage(lookup.message, lookup.options);

    // getTranslationsSnapshot('fr-FR') keys its catalog by the raw locale.
    expect(
      new I18nStore().getTranslateSnapshot(
        { ...lookup, locale: 'fr-FR' },
        { 'fr-FR': { [hash]: 'Bonjour' } }
      )
    ).toBe('Bonjour');
  });

  it('reads no snapshot entry for an invalid locale in production, as the cache does', () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.spyOn(console, 'error').mockImplementation(() => {});
    initializeI18nConfig({ defaultLocale: 'en', locales: ['en', 'fr'] });
    setReactI18nCache(
      new ReactI18nCache({ loadTranslations: async () => ({}) })
    );

    try {
      expect(
        new I18nStore().getTranslateSnapshot(
          { ...lookup, locale: 'not a locale!!' },
          {}
        )
      ).toBeUndefined();
    } finally {
      vi.unstubAllEnvs();
    }
  });
});
