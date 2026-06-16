import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { initializeI18nConfig } from '@generaltranslation/react-core/context';
import {
  defaultEnableI18nCookieName as defaultEnableI18nStoreKey,
  defaultLocaleCookieName as defaultLocaleStoreKey,
  defaultRegionCookieName as defaultRegionStoreKey,
} from '@generaltranslation/react-core/internal';
import { NativeConditionStore } from '../NativeConditionStore';

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

  it('reads persisted locale through the native store', () => {
    nativeStore.set(defaultLocaleStoreKey, 'fr');

    const conditionStore = new NativeConditionStore({});

    expect(conditionStore.getLocale()).toBe('fr');
  });

  it('persists explicit locale through the native store', () => {
    nativeStore.set(defaultLocaleStoreKey, 'fr');

    const conditionStore = new NativeConditionStore({
      locale: 'es',
    });

    expect(nativeStore.get(defaultLocaleStoreKey)).toBe('es');
    expect(conditionStore.getLocale()).toBe('es');

    conditionStore.setLocale('fr');

    expect(nativeStore.get(defaultLocaleStoreKey)).toBe('fr');
    expect(conditionStore.getLocale()).toBe('fr');
  });

  it('persists region and enableI18n through the native store', () => {
    nativeStore.set(defaultRegionStoreKey, 'CA');
    nativeStore.set(defaultEnableI18nStoreKey, 'false');

    const conditionStore = new NativeConditionStore({
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
