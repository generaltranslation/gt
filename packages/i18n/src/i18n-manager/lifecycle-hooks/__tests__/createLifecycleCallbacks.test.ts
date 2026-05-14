import { describe, expect, it, vi } from 'vitest';
import { createLifecycleCallbacks } from '../createLifecycleCallbacks';
import type { TranslationsCache } from '../../translations-manager/TranslationsCache';

describe('createLifecycleCallbacks', () => {
  it('does not build locale translations payloads without listeners', () => {
    const emit = vi.fn();
    const lifecycle = createLifecycleCallbacks<string>(emit, () => false);
    const translationsCache = {
      getInternalCache: vi.fn(() => ({ hash: 'Bonjour' })),
    } as unknown as TranslationsCache<string>;
    const params = {
      inputKey: 'fr',
      cacheKey: 'fr',
      cacheValue: {
        expiresAt: -1,
        value: translationsCache,
      },
      outputValue: translationsCache,
    };

    lifecycle.onLocalesCacheHit?.(params);
    lifecycle.onLocalesCacheMiss?.(params);

    expect(translationsCache.getInternalCache).not.toHaveBeenCalled();
    expect(emit).not.toHaveBeenCalled();
  });
});
