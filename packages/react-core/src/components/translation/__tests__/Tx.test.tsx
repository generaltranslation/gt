import { beforeEach, describe, expect, it, vi } from 'vitest';
import { initializeI18nConfig } from 'gt-i18n/internal';
import { setReactI18nCache } from '../../../i18n-cache/singleton-operations';
import { RscTx } from '../Tx.rsc';
import type { ReactI18nCache } from '../../../i18n-cache/ReactI18nCache';

type TestGlobal = typeof globalThis & {
  __generaltranslation?: unknown;
};

function resetGTGlobals() {
  Reflect.deleteProperty(globalThis as TestGlobal, '__generaltranslation');
}

const lookupTranslationWithFallback = vi.fn();

function setup() {
  initializeI18nConfig({
    defaultLocale: 'en',
    locales: ['en', 'fr'],
  });
  setReactI18nCache({
    lookupTranslationWithFallback,
  } as unknown as ReactI18nCache);
}

// In development the cache rethrows lookup failures (for example a 401 from
// an invalid dev API key), so the awaited runtime lookup here used to crash
// the RSC render instead of degrading to source content.
describe('RscTx runtime translation failure handling', () => {
  let consoleError: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    resetGTGlobals();
    vi.clearAllMocks();
    setup();
    consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  it('renders the translation when the runtime lookup resolves', async () => {
    lookupTranslationWithFallback.mockResolvedValue('Bonjour');

    await expect(
      RscTx({ children: 'Hello', _locale: 'fr', _enableI18n: true })
    ).resolves.toBe('Bonjour');

    expect(consoleError).not.toHaveBeenCalled();
  });

  it('renders source and logs once when the runtime lookup rejects', async () => {
    lookupTranslationWithFallback.mockRejectedValue(
      new Error('Remote translation request failed: 401 (Tx runtime)')
    );

    await expect(
      RscTx({ children: 'Hello', _locale: 'fr', _enableI18n: true })
    ).resolves.toBe('Hello');

    expect(consoleError).toHaveBeenCalledTimes(1);
    expect(consoleError).toHaveBeenCalledWith(
      expect.stringContaining('401 (Tx runtime)')
    );
  });

  it('logs an identical failure once across renders', async () => {
    lookupTranslationWithFallback.mockRejectedValue(
      new Error('Remote translation request failed: 401 (Tx dedupe)')
    );

    await expect(
      RscTx({ children: 'Hello', _locale: 'fr', _enableI18n: true })
    ).resolves.toBe('Hello');
    await expect(
      RscTx({ children: 'Goodbye', _locale: 'fr', _enableI18n: true })
    ).resolves.toBe('Goodbye');

    expect(consoleError).toHaveBeenCalledTimes(1);
  });
});
