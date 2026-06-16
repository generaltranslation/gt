import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  getReadonlyConditionStoreWithFallback,
  initializeI18nConfig,
} from '@generaltranslation/react-core/context';
import {
  defaultEnableI18nCookieName as defaultEnableI18nStoreKey,
  defaultLocaleCookieName as defaultLocaleStoreKey,
  defaultRegionCookieName as defaultRegionStoreKey,
} from '@generaltranslation/react-core/internal';
import { createOrUpdateNativeConditionStore } from '../createNativeConditionStore';

const nativeStore = vi.hoisted(() => new Map<string, string>());

vi.mock('../../utils/getNativeLocales', () => ({
  getNativeLocales: () => ['es'],
}));

vi.mock('../../utils/nativeStore', () => ({
  nativeStoreGet: (key: string) => nativeStore.get(key) ?? null,
  nativeStoreSet: (key: string, value: string) => {
    nativeStore.set(key, value);
  },
}));

vi.mock('@generaltranslation/react-core/context', async (importOriginal) => {
  const actual =
    await importOriginal<
      typeof import('@generaltranslation/react-core/context')
    >();
  return {
    ...actual,
    getTranslationsSnapshot: vi.fn(async () => ({})),
  };
});

describe('NativeConditionStore', () => {
  beforeEach(() => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    nativeStore.clear();
    initializeI18nConfig(
      {
        defaultLocale: 'en',
        locales: ['en', 'es', 'fr'],
      },
      'SPA'
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('reads and writes locale through the native store', () => {
    nativeStore.set(defaultLocaleStoreKey, 'fr');

    const conditionStore = createOrUpdateNativeConditionStore({
      locale: 'es',
    });

    expect(conditionStore.getLocale()).toBe('fr');
    expect(getReadonlyConditionStoreWithFallback()).toBe(conditionStore);

    conditionStore.setLocale('es');

    expect(nativeStore.get(defaultLocaleStoreKey)).toBe('es');
    expect(conditionStore.getLocale()).toBe('es');
  });

  it('persists region and enableI18n through the native store', () => {
    nativeStore.set(defaultRegionStoreKey, 'CA');
    nativeStore.set(defaultEnableI18nStoreKey, 'false');

    const conditionStore = createOrUpdateNativeConditionStore({
      region: 'US',
      enableI18n: true,
    });

    expect(conditionStore.getRegion()).toBe('CA');
    expect(conditionStore.getEnableI18n()).toBe(false);

    conditionStore.setRegion('US');
    conditionStore.setEnableI18n(true);

    expect(nativeStore.get(defaultRegionStoreKey)).toBe('US');
    expect(nativeStore.get(defaultEnableI18nStoreKey)).toBe('true');
  });
});
