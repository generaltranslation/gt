import { describe, expect, it, vi } from 'vitest';
import { I18nManager } from 'gt-i18n/internal';
import { I18nExternalStore } from '../../external-store/store/I18nExternalStore';
import { ProviderConditionStore } from '../../external-store/store/ProviderConditionStore';

function createManager() {
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

function createConditionStore(locale = 'en') {
  return new ProviderConditionStore({
    defaultLocale: 'en',
    locales: ['en', 'fr', 'es'],
    locale,
  });
}

describe('external store i18n wiring', () => {
  it('notifies only locale subscribers when locale changes', () => {
    const conditionStore = createConditionStore('en');
    const localeListener = vi.fn();
    const unsubscribeLocale = conditionStore.subscribeToLocale(localeListener);

    conditionStore.setLocale('fr');

    expect(conditionStore.getLocale()).toBe('fr');
    expect(localeListener).toHaveBeenCalledTimes(1);

    unsubscribeLocale();
  });

  it('notifies region subscribers when region changes', () => {
    const conditionStore = createConditionStore('en');
    const regionListener = vi.fn();
    const unsubscribeRegion = conditionStore.subscribeToRegion(regionListener);

    conditionStore.setRegion('US');

    expect(conditionStore.getRegion()).toBe('US');
    expect(regionListener).toHaveBeenCalledTimes(1);

    unsubscribeRegion();
  });

  it('notifies translation subscribers for matching cache updates', async () => {
    const manager = createManager();
    const externalStore = new I18nExternalStore({ i18nManager: manager });
    const matchingListener = vi.fn();
    const otherHashListener = vi.fn();
    const otherLocaleListener = vi.fn();

    const unsubscribeMatching = externalStore.subscribeToTranslate(
      {
        locale: 'fr',
        message: 'Hello',
        options: { $format: 'ICU', $_hash: 'hash' },
      },
      matchingListener
    );
    const unsubscribeOtherHash = externalStore.subscribeToTranslate(
      {
        locale: 'fr',
        message: 'Other',
        options: { $format: 'ICU', $_hash: 'other' },
      },
      otherHashListener
    );
    const unsubscribeOtherLocale = externalStore.subscribeToTranslate(
      {
        locale: 'es',
        message: 'Hello',
        options: { $format: 'ICU', $_hash: 'hash' },
      },
      otherLocaleListener
    );

    await manager.lookupTranslationWithFallback('fr', 'Hello', {
      $format: 'ICU',
      $_hash: 'hash',
    });

    expect(matchingListener).toHaveBeenCalledTimes(1);
    expect(otherHashListener).not.toHaveBeenCalled();
    expect(otherLocaleListener).not.toHaveBeenCalled();

    unsubscribeMatching();
    unsubscribeOtherHash();
    unsubscribeOtherLocale();
  });

  it('notifies translate many subscribers for matching cache updates', async () => {
    const manager = createManager();
    const externalStore = new I18nExternalStore({ i18nManager: manager });
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

    const initialSnapshot = externalStore.getTranslateManySnapshot(lookups);
    expect(externalStore.getTranslateManySnapshot(lookups)).toBe(
      initialSnapshot
    );

    const unsubscribe = externalStore.subscribeToTranslateMany(
      lookups,
      listener
    );

    await manager.lookupTranslationWithFallback('fr', 'Hello', {
      $format: 'ICU',
      $_hash: 'hash',
    });

    expect(listener).toHaveBeenCalledTimes(1);
    expect(externalStore.getTranslateManySnapshot(lookups)).toEqual([
      'Bonjour',
      undefined,
    ]);

    unsubscribe();
  });

  it('notifies dictionary entry subscribers for matching cache misses', async () => {
    const manager = createManager();
    const externalStore = new I18nExternalStore({ i18nManager: manager });
    const matchingListener = vi.fn();
    const otherListener = vi.fn();

    const unsubscribeMatching = externalStore.subscribeToDictionaryEntry(
      { locale: 'fr', id: 'greeting' },
      matchingListener
    );
    const unsubscribeOther = externalStore.subscribeToDictionaryEntry(
      { locale: 'fr', id: 'other' },
      otherListener
    );

    await manager.lookupDictionaryWithFallback('fr', 'greeting');

    expect(matchingListener).toHaveBeenCalledTimes(1);
    expect(otherListener).not.toHaveBeenCalled();

    unsubscribeMatching();
    unsubscribeOther();
  });

  it('notifies dictionary object subscribers for matching cache misses', async () => {
    const manager = createManager();
    const externalStore = new I18nExternalStore({ i18nManager: manager });
    const matchingListener = vi.fn();
    const otherListener = vi.fn();

    const unsubscribeMatching = externalStore.subscribeToDictionaryObject(
      { locale: 'fr', id: 'user.profile' },
      matchingListener
    );
    const unsubscribeOther = externalStore.subscribeToDictionaryObject(
      { locale: 'fr', id: 'other' },
      otherListener
    );

    await manager.lookupDictionaryObjWithFallback('fr', 'user.profile');

    expect(matchingListener).toHaveBeenCalledTimes(1);
    expect(otherListener).not.toHaveBeenCalled();

    unsubscribeMatching();
    unsubscribeOther();
  });
});
