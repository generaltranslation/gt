import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { initializeI18nConfig } from '@generaltranslation/react-core/context';
import {
  defaultEnableI18nCookieName as defaultEnableI18nStoreKey,
  defaultLocaleCookieName as defaultLocaleStoreKey,
  defaultRegionCookieName as defaultRegionStoreKey,
} from '@generaltranslation/react-core/internal';
import { NativeConditionStore } from '../NativeConditionStore';

const nativeStore = vi.hoisted(() => new Map<string, string>());
const nativeStoreMock = vi.hoisted(() => ({
  skipWrites: false,
}));

vi.mock('../../utils/getNativeLocales', () => ({
  getNativeLocales: () => ['es'],
}));

vi.mock('../../utils/nativeStore', () => ({
  nativeStoreGet: (key: string) => nativeStore.get(key) ?? null,
  nativeStoreSet: (key: string, value: string) => {
    if (nativeStoreMock.skipWrites) return;
    nativeStore.set(key, value);
  },
}));

describe('NativeConditionStore', () => {
  beforeEach(() => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    nativeStore.clear();
    nativeStoreMock.skipWrites = false;
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

  it('calls reload after condition updates', () => {
    const reload = vi.fn();
    const conditionStore = new NativeConditionStore({
      _reload: reload,
    });

    conditionStore.setLocale('fr');

    expect(reload).toHaveBeenCalledWith({
      locale: 'fr',
      region: undefined,
      enableI18n: true,
    });
  });

  it('reloads with the selected locale even when native storage reads stale', () => {
    nativeStore.set(defaultLocaleStoreKey, 'es');
    nativeStoreMock.skipWrites = true;
    const reload = vi.fn();
    const conditionStore = new NativeConditionStore({
      _reload: reload,
    });

    conditionStore.setLocale('fr');

    expect(conditionStore.getLocale()).toBe('es');
    expect(reload).toHaveBeenCalledWith({
      locale: 'fr',
      region: undefined,
      enableI18n: true,
    });
  });

  it('persists explicit region and enableI18n through the native store', () => {
    nativeStore.set(defaultRegionStoreKey, 'CA');
    nativeStore.set(defaultEnableI18nStoreKey, 'false');

    const conditionStore = new NativeConditionStore({
      region: 'US',
      enableI18n: true,
    });

    expect(nativeStore.get(defaultRegionStoreKey)).toBe('US');
    expect(nativeStore.get(defaultEnableI18nStoreKey)).toBe('true');
    expect(conditionStore.getRegion()).toBe('US');
    expect(conditionStore.getEnableI18n()).toBe(true);

    conditionStore.setRegion('CA');
    conditionStore.setEnableI18n(false);

    expect(nativeStore.get(defaultRegionStoreKey)).toBe('CA');
    expect(nativeStore.get(defaultEnableI18nStoreKey)).toBe('false');
  });
});
