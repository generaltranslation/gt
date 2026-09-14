import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { initializeI18nConfig } from '@generaltranslation/react-core/pure';
import { BrowserI18nCache } from '../BrowserI18nCache';

class RuntimeTranslationCache extends BrowserI18nCache {
  receiveRuntimeTranslation(locale: string, hash: string, translation: string) {
    // Simulate a completed runtime request without contacting GT services.
    this.onTranslationsCacheMiss?.({ locale, hash, translation });
  }
}

describe('BrowserI18nCache locale persistence', () => {
  beforeEach(() => {
    Reflect.deleteProperty(globalThis, '__generaltranslation');
    vi.stubEnv('NODE_ENV', 'development');
    vi.useFakeTimers();
    const storage = new Map<string, string>();
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => storage.set(key, value),
    });
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    Reflect.deleteProperty(globalThis, '__generaltranslation');
  });

  it.each([true, false])(
    'restores runtime translations after cache recreation (aliases=%s)',
    async (aliases) => {
      initializeI18nConfig({
        defaultLocale: 'en-US',
        locales: ['en-US', 'en-GB'],
        customMapping: aliases ? { 'en-gb': { code: 'en-GB' } } : {},
        projectId: 'test-project',
        devApiKey: 'test-key',
      });
      const loadTranslations = vi.fn(async () => ({ existing: 'Built text' }));
      const cache = new RuntimeTranslationCache({ loadTranslations });
      expect(cache.isDevHotReloadJsx()).toBe(true);
      await expect(cache.loadTranslations('en-GB')).resolves.toEqual({
        existing: 'Built text',
      });

      // The internal resource cache emits its resolved supported locale.
      cache.receiveRuntimeTranslation('en-GB', 'runtime', 'Runtime text');
      await vi.advanceTimersByTimeAsync(600);

      const reloadedCache = new RuntimeTranslationCache({ loadTranslations });
      await expect(reloadedCache.loadTranslations('en-GB')).resolves.toEqual({
        existing: 'Built text',
        runtime: 'Runtime text',
      });
      expect(loadTranslations).toHaveBeenLastCalledWith(
        aliases ? 'en-gb' : 'en-GB'
      );
    }
  );
});
