import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  I18nCache,
  initializeI18nConfig,
  isDictionaryManagerInitialized,
  setI18nCache,
  setDictionaryManager,
  type DictionaryManager,
} from 'gt-i18n/internal';
import { CompatStore } from '../CompatStore';

type TestGlobal = typeof globalThis & {
  __generaltranslation?: unknown;
};

function resetGTGlobals() {
  Reflect.deleteProperty(globalThis as TestGlobal, '__generaltranslation');
}

const lookupDictionaryWithFallback = vi.fn();
const lookupDictionaryObjWithFallback = vi.fn();

function setup() {
  initializeI18nConfig({
    defaultLocale: 'en',
    locales: ['en', 'fr'],
  });
  setDictionaryManager({
    lookupDictionaryWithFallback,
    lookupDictionaryObjWithFallback,
  } as unknown as DictionaryManager);
}

// In development the dictionary manager rejects when the runtime API rejects
// the request (for example a 401 from an invalid dev API key). SSR fires these
// store methods without awaiting them, so a rejection must not become an
// unhandled rejection that kills the dev server.
const rejectedKeyError = new Error(
  'Remote translation request failed: 401 Invalid API key'
);

describe('CompatStore runtime translation failure handling', () => {
  let consoleError: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    resetGTGlobals();
    vi.clearAllMocks();
    setup();
    consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  it('translateDictionaryEntry() logs instead of leaving an unhandled rejection', async () => {
    lookupDictionaryWithFallback.mockRejectedValue(rejectedKeyError);
    const store = new CompatStore();

    store.translateDictionaryEntry({ locale: 'fr', id: 'greeting' });

    await vi.waitFor(() => expect(consoleError).toHaveBeenCalledTimes(1));
  });

  it('translateDictionaryObject() logs instead of leaving an unhandled rejection', async () => {
    lookupDictionaryObjWithFallback.mockRejectedValue(rejectedKeyError);
    const store = new CompatStore();

    store.translateDictionaryObject({ locale: 'fr', id: 'nav' });

    await vi.waitFor(() => expect(consoleError).toHaveBeenCalledTimes(1));
  });
});

describe('CompatStore dictionary manager', () => {
  beforeEach(() => {
    resetGTGlobals();
    initializeI18nConfig({
      defaultLocale: 'en',
      locales: ['en', 'fr'],
    });
  });

  it('ignores an empty dictionaries snapshot', () => {
    new CompatStore().updateDictionaries({});

    expect(isDictionaryManagerInitialized()).toBe(false);
  });

  it('does not create a dictionary manager from render-time reads or server translations', () => {
    const store = new CompatStore();
    const lookup = { locale: 'fr', id: 'greeting' };

    expect(store.getDictionaryEntrySnapshot(lookup)).toBeUndefined();
    expect(store.getDictionaryObjectSnapshot(lookup)).toBeUndefined();
    store.translateDictionaryEntry(lookup);
    store.translateDictionaryObject(lookup);

    // gt-next seeds the manager with the bundled dictionary on first use, so
    // an empty one created here would hide it for the rest of the process.
    expect(isDictionaryManagerInitialized()).toBe(false);
  });

  it('creates a dictionary manager for snapshot-only runtimes', () => {
    setI18nCache(new I18nCache({ loadTranslations: async () => ({}) }));
    const store = new CompatStore();

    store.updateDictionaries({ fr: { greeting: 'Bonjour' } });

    expect(isDictionaryManagerInitialized()).toBe(true);
    expect(
      store.getDictionaryEntrySnapshot({ locale: 'fr', id: 'greeting' })
    ).toEqual({ entry: 'Bonjour', options: {} });
  });
});
