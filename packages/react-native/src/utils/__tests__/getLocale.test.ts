import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getLocale } from '../getLocale';
import { defaultLocaleStoreKey } from '../storeKeys';
import { initializeI18nConfig } from '@generaltranslation/react-core/pure';

const nativeStore = vi.hoisted(() => new Map<string, string>());

vi.mock('../getNativeLocales', () => ({
  getNativeLocales: () => ['es'],
}));

vi.mock('../nativeStore', () => ({
  nativeStoreGet: (key: string) => nativeStore.get(key) ?? null,
}));

describe('getLocale', () => {
  beforeEach(() => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    nativeStore.clear();
    initializeI18nConfig(
      {
        defaultLocale: 'en',
        locales: ['en', 'es', 'fr'],
      },
      'server-render'
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('reads the persisted locale without a condition store', () => {
    nativeStore.set(defaultLocaleStoreKey, 'fr');

    expect(getLocale()).toBe('fr');
  });

  it('falls back to native device locales', () => {
    expect(getLocale()).toBe('es');
  });
});
