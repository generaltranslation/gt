import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { initializeI18nConfig } from 'gt-i18n/internal';
import { setReactI18nCache } from '../../../i18n-cache/singleton-operations';
import { RscT } from '../T.rsc';
import type { ReactI18nCache } from '../../../i18n-cache/ReactI18nCache';

type TestGlobal = typeof globalThis & {
  __generaltranslation?: unknown;
};

function resetGTGlobals() {
  Reflect.deleteProperty(globalThis as TestGlobal, '__generaltranslation');
}

const getLookupTranslation = vi.fn();
const lookupTranslationWithFallback = vi.fn();

function setup(configParams: Record<string, unknown> = {}) {
  initializeI18nConfig({
    defaultLocale: 'en',
    locales: ['en', 'fr'],
    ...configParams,
  });
  setReactI18nCache({
    getLookupTranslation,
    lookupTranslationWithFallback,
  } as unknown as ReactI18nCache);
}

describe('RscT', () => {
  beforeEach(() => {
    resetGTGlobals();
    vi.clearAllMocks();
    setup();
  });

  it('loads translations and looks up with the explicit locale', async () => {
    const lookupTranslation = vi.fn(() => 'Bonjour');
    getLookupTranslation.mockResolvedValue(lookupTranslation);

    await expect(
      RscT({ children: 'Hello', _locale: 'fr', _enableI18n: true })
    ).resolves.toBe('Bonjour');

    expect(getLookupTranslation).toHaveBeenCalledWith('fr');
    expect(lookupTranslation).toHaveBeenCalledWith(
      'Hello',
      expect.objectContaining({
        $format: 'JSX',
        $locale: 'fr',
      })
    );
  });

  it('renders source without loading translations for the default locale', async () => {
    await expect(
      RscT({ children: 'Hello', _locale: 'en', _enableI18n: true })
    ).resolves.toBe('Hello');

    expect(getLookupTranslation).not.toHaveBeenCalled();
  });

  it('renders source without loading translations when i18n is disabled', async () => {
    await expect(
      RscT({ children: 'Hello', _locale: 'fr', _enableI18n: false })
    ).resolves.toBe('Hello');

    expect(getLookupTranslation).not.toHaveBeenCalled();
  });
});

// In development the cache rethrows lookup failures (for example a 401 from
// an invalid dev API key), so the awaited lookups here used to crash the RSC
// render instead of degrading to source content.
describe('RscT runtime translation failure handling', () => {
  let consoleError: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    resetGTGlobals();
    vi.resetAllMocks();
    setup();
    consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('renders source and logs once when getLookupTranslation rejects', async () => {
    getLookupTranslation.mockRejectedValue(
      new Error('Remote translation request failed: 401 (T lookup)')
    );

    await expect(
      RscT({ children: 'Hello', _locale: 'fr', _enableI18n: true })
    ).resolves.toBe('Hello');

    expect(consoleError).toHaveBeenCalledTimes(1);
    expect(consoleError).toHaveBeenCalledWith(
      expect.stringContaining('401 (T lookup)')
    );
  });

  it('renders source when the dev hot reload lookup rejects', async () => {
    vi.stubEnv('NODE_ENV', 'development');
    // The config singleton keeps its first instance, so re-init from scratch
    // to enable dev hot reload.
    resetGTGlobals();
    setup({ devApiKey: 'invalid-dev-key', projectId: 'test-project' });
    lookupTranslationWithFallback.mockRejectedValue(
      new Error('Remote translation request failed: 401 (T hot reload)')
    );

    await expect(
      RscT({ children: 'Hello', _locale: 'fr', _enableI18n: true })
    ).resolves.toBe('Hello');

    expect(lookupTranslationWithFallback).toHaveBeenCalledTimes(1);
    expect(consoleError).toHaveBeenCalledTimes(1);
    expect(consoleError).toHaveBeenCalledWith(
      expect.stringContaining('401 (T hot reload)')
    );
  });
});
