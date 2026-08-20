import { beforeEach, describe, expect, it, vi } from 'vitest';
import { initializeI18nConfig } from 'gt-i18n/internal';
import { setReactI18nCache } from '../../i18n-cache/singleton-operations';
import { I18nStore } from '../I18nStore';
import type { ReactI18nCache } from '../../i18n-cache/ReactI18nCache';
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

  it('translateDictionaryObject() logs instead of leaving an unhandled rejection', async () => {
    lookupDictionaryObjWithFallback.mockRejectedValue(rejectedKeyError);
    const store = new I18nStore();

    store.translateDictionaryObject({ locale: 'fr', id: 'nav' });

    await vi.waitFor(() => expect(consoleError).toHaveBeenCalledTimes(1));
  });
});
