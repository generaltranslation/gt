import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createLookupOptions,
  getTranslateListenerKey,
  I18nCache,
  initializeI18nConfig,
} from 'gt-i18n/internal';
import { setReactI18nCache } from '../../i18n-cache/singleton-operations';
import { I18nStore } from '../I18nStore';
import type { StringFormat } from '@generaltranslation/format/types';

const message = 'Hello';
const translatedMessage = 'Bonjour';
const lookupOptions = createLookupOptions<StringFormat>('fr', {}, 'ICU');
const lookup = {
  locale: 'fr',
  message,
  options: lookupOptions,
};

function getHash(): string {
  const listenerKey = getTranslateListenerKey(lookup);
  return listenerKey.slice(listenerKey.indexOf(':') + 1);
}

function setup() {
  initializeI18nConfig({
    defaultLocale: 'en',
    locales: ['en', 'fr'],
  });
  setReactI18nCache(
    new I18nCache({
      loadTranslations: vi.fn().mockResolvedValue({}),
    })
  );
}

describe('I18nStore provider snapshots', () => {
  beforeEach(() => {
    setup();
  });

  it('resolves provider translations before the global cache on first lookup', () => {
    const globalStore = new I18nStore({});
    const scopedStore = new I18nStore({
      translations: {
        fr: {
          [getHash()]: translatedMessage,
        },
      },
    });

    expect(globalStore.getTranslateSnapshot(lookup)).toBeUndefined();
    expect(scopedStore.getTranslateSnapshot(lookup)).toBe(translatedMessage);
  });

  it('resolves provider dictionaries before the global cache', () => {
    const globalStore = new I18nStore({});
    const scopedStore = new I18nStore({
      dictionaries: {
        en: {
          greeting: 'Hello',
        },
        fr: {
          greeting: 'Bonjour',
        },
      },
    });

    expect(
      globalStore.getDictionaryEntrySnapshot({
        locale: 'fr',
        id: 'greeting',
      })
    ).toBeUndefined();
    expect(
      scopedStore.getDictionaryEntrySnapshot({
        locale: 'fr',
        id: 'greeting',
      })
    ).toEqual({
      entry: 'Bonjour',
      options: {},
    });
  });

  it('does not notify global subscribers when server snapshots are scoped', () => {
    const globalStore = new I18nStore({});
    const listener = vi.fn();
    globalStore.subscribeToTranslate(lookup, listener);

    const scopedStore = new I18nStore({
      translations: {
        fr: {
          [getHash()]: translatedMessage,
        },
      },
    });

    expect(scopedStore.getTranslateSnapshot(lookup)).toBe(translatedMessage);
    expect(listener).not.toHaveBeenCalled();
  });
});
