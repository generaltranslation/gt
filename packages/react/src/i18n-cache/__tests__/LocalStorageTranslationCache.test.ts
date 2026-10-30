import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LocalStorageTranslationCache } from '../LocalStorageTranslationCache';

const storageKey = 'gt:tx:project:fr';
const store = new Map<string, string>();

function createCache() {
  return new LocalStorageTranslationCache({
    locale: 'fr',
    projectId: 'project',
    purgeInterval: 1000,
  });
}

describe('LocalStorageTranslationCache', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    store.clear();
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => store.set(key, value),
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it.each(['null', '1', '"text"', '["a"]'])(
    'replaces non-object stored JSON %s on the next write',
    (stored) => {
      store.set(storageKey, stored);
      const cache = createCache();

      expect(cache.getInternalCache()).toEqual({});
      cache.write('hash', 'bonjour');
      vi.advanceTimersByTime(500);

      expect(Object.keys(JSON.parse(store.get(storageKey)!))).toEqual(['hash']);
    }
  );

  it('purges entries with a missing or non-numeric expiry', () => {
    store.set(
      storageKey,
      JSON.stringify({
        empty: null,
        noExpiry: { t: 'x' },
        textExpiry: { t: 'y', exp: 'never' },
      })
    );
    const cache = createCache();

    expect(cache.getInternalCache()).toEqual({});
    vi.advanceTimersByTime(1000);

    expect(JSON.parse(store.get(storageKey)!)).toEqual({});
  });
});
