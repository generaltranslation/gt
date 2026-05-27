import { describe, expect, it, vi } from 'vitest';
import {
  I18nManager,
  initializeI18nConfig,
  WritableConditionStore,
} from 'gt-i18n/internal';
import { setReadonlyConditionStore as setConditionStore } from '../../../condition-store/singleton-operations';
import { setReactI18nCache } from '../../../i18n-cache/singleton-operations';
import { I18nStore } from '../../../i18n-store/I18nStore';

function createManager() {
  initializeI18nConfig({
    defaultLocale: 'en',
    locales: ['en', 'fr', 'es'],
  });

  return new I18nManager({
    defaultLocale: 'en',
    locales: ['en', 'fr', 'es'],
    dictionary: {
      greeting: 'Hello',
      user: {
        profile: {
          name: 'Name',
        },
      },
    },
    loadDictionary: vi.fn().mockResolvedValue({
      greeting: 'Bonjour',
      user: {
        profile: {
          name: 'Nom',
        },
      },
    }),
    loadTranslations: vi.fn().mockResolvedValue({
      hash: 'Bonjour',
    }),
  });
}

function createStores(locale = 'en') {
  const manager = createManager();
  setReactI18nCache(manager);

  const conditionStore = new WritableConditionStore({ locale });
  setConditionStore(conditionStore);

  const i18nStore = new I18nStore({});
  return { i18nStore };
}

async function flushAsyncUpdates() {
  await new Promise((resolve) => setTimeout(resolve, 0));
}

describe('external store i18n wiring', () => {
  it('notifies translation subscribers for matching cache updates', async () => {
    const { i18nStore } = createStores();
    const matchingListener = vi.fn();
    const otherHashListener = vi.fn();
    const otherLocaleListener = vi.fn();

    const unsubscribeMatching = i18nStore.subscribeToTranslate(
      {
        locale: 'fr',
        message: 'Hello',
        options: { $format: 'ICU', $_hash: 'hash' },
      },
      matchingListener
    );
    const unsubscribeOtherHash = i18nStore.subscribeToTranslate(
      {
        locale: 'fr',
        message: 'Other',
        options: { $format: 'ICU', $_hash: 'other' },
      },
      otherHashListener
    );
    const unsubscribeOtherLocale = i18nStore.subscribeToTranslate(
      {
        locale: 'es',
        message: 'Hello',
        options: { $format: 'ICU', $_hash: 'hash' },
      },
      otherLocaleListener
    );

    i18nStore.translate({
      locale: 'fr',
      message: 'Hello',
      options: {
        $format: 'ICU',
        $_hash: 'hash',
      },
    });
    await flushAsyncUpdates();

    expect(
      i18nStore.getTranslateSnapshot({
        locale: 'fr',
        message: 'Hello',
        options: {
          $format: 'ICU',
          $_hash: 'hash',
        },
      })
    ).toBe('Bonjour');

    expect(matchingListener).toHaveBeenCalledTimes(1);
    expect(otherHashListener).not.toHaveBeenCalled();
    expect(otherLocaleListener).not.toHaveBeenCalled();

    unsubscribeMatching();
    unsubscribeOtherHash();
    unsubscribeOtherLocale();
  });

  it('notifies translate many subscribers for matching cache updates', async () => {
    const { i18nStore } = createStores();
    const listener = vi.fn();
    const lookups = [
      {
        locale: 'fr',
        message: 'Hello',
        options: { $format: 'ICU' as const, $_hash: 'hash' },
      },
      {
        locale: 'fr',
        message: 'Other',
        options: { $format: 'ICU' as const, $_hash: 'other' },
      },
    ];

    const initialSnapshot = i18nStore.getTranslateManySnapshot(lookups);
    expect(i18nStore.getTranslateManySnapshot(lookups)).toBe(initialSnapshot);

    const unsubscribe = i18nStore.subscribeToTranslateMany(lookups, listener);

    i18nStore.translate({
      locale: 'fr',
      message: 'Hello',
      options: {
        $format: 'ICU',
        $_hash: 'hash',
      },
    });
    await flushAsyncUpdates();

    expect(listener).toHaveBeenCalledTimes(1);
    expect(i18nStore.getTranslateManySnapshot(lookups)).toEqual([
      'Bonjour',
      undefined,
    ]);

    unsubscribe();
  });

  it('notifies dictionary entry subscribers for matching cache misses', async () => {
    const { i18nStore } = createStores();
    const matchingListener = vi.fn();
    const otherListener = vi.fn();

    const unsubscribeMatching = i18nStore.subscribeToDictionaryEntry(
      { locale: 'fr', id: 'greeting' },
      matchingListener
    );
    const unsubscribeOther = i18nStore.subscribeToDictionaryEntry(
      { locale: 'fr', id: 'other' },
      otherListener
    );

    i18nStore.translateDictionaryEntry({ locale: 'fr', id: 'greeting' });
    await flushAsyncUpdates();

    expect(matchingListener).toHaveBeenCalledTimes(1);
    expect(otherListener).not.toHaveBeenCalled();

    unsubscribeMatching();
    unsubscribeOther();
  });

  it('notifies dictionary object subscribers for matching cache misses', async () => {
    const { i18nStore } = createStores();
    const matchingListener = vi.fn();
    const otherListener = vi.fn();

    const unsubscribeMatching = i18nStore.subscribeToDictionaryObject(
      { locale: 'fr', id: 'user.profile' },
      matchingListener
    );
    const unsubscribeOther = i18nStore.subscribeToDictionaryObject(
      { locale: 'fr', id: 'other' },
      otherListener
    );

    i18nStore.translateDictionaryObject({ locale: 'fr', id: 'user.profile' });
    await flushAsyncUpdates();

    expect(matchingListener).toHaveBeenCalledTimes(1);
    expect(otherListener).not.toHaveBeenCalled();

    unsubscribeMatching();
    unsubscribeOther();
  });
});
