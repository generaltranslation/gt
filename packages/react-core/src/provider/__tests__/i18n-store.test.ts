import { describe, expect, it, vi } from 'vitest';
import { I18nManager, setConditionStore, setI18nManager } from 'gt-i18n/internal';
import { I18nExternalStore } from '../i18n-store/I18nExternalStore';
import { setI18nExternalConditionStore } from '../i18n-store/condition-store/externalConditionStore';

class TestConditionStore {
  private localeListeners = new Set<() => void>();
  private regionListeners = new Set<() => void>();
  private region: string | undefined;

  constructor(private locale: string) {}

  getLocale(): string {
    return this.locale;
  }

  setLocale(locale: string): void {
    this.locale = locale;
    this.localeListeners.forEach((listener) => listener());
  }

  subscribeToLocale(listener: () => void): () => void {
    this.localeListeners.add(listener);
    return () => {
      this.localeListeners.delete(listener);
    };
  }

  getRegion(): string | undefined {
    return this.region;
  }

  setRegion(region: string | undefined): void {
    this.region = region;
    this.regionListeners.forEach((listener) => listener());
  }

  subscribeToRegion(listener: () => void): () => void {
    this.regionListeners.add(listener);
    return () => {
      this.regionListeners.delete(listener);
    };
  }
}

function installManager() {
  const manager = new I18nManager({
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
  setI18nManager(manager);
  return manager;
}

function installConditionStore(locale = 'en') {
  const conditionStore = new TestConditionStore(locale);
  setConditionStore(conditionStore);
  setI18nExternalConditionStore(conditionStore);
  return conditionStore;
}

describe('i18n external store', () => {
  it('notifies only locale subscribers when locale changes', () => {
    installManager();
    const conditionStore = installConditionStore('en');
    const externalStore = new I18nExternalStore();
    const localeListener = vi.fn();
    const defaultLocaleListener = vi.fn();

    const unsubscribeLocale =
      externalStore.subscribeToLocale(localeListener);
    const unsubscribeDefaultLocale =
      externalStore.subscribeToDefaultLocale(defaultLocaleListener);

    conditionStore.setLocale('fr');

    expect(externalStore.getLocaleSnapshot()).toBe('fr');
    expect(localeListener).toHaveBeenCalledTimes(1);
    expect(defaultLocaleListener).not.toHaveBeenCalled();

    unsubscribeLocale();
    unsubscribeDefaultLocale();
  });

  it('notifies region subscribers when region changes', () => {
    installManager();
    const conditionStore = installConditionStore('en');
    const externalStore = new I18nExternalStore();
    const regionListener = vi.fn();
    const unsubscribeRegion =
      externalStore.subscribeToRegion(regionListener);

    conditionStore.setRegion('US');

    expect(externalStore.getRegionSnapshot()).toBe('US');
    expect(regionListener).toHaveBeenCalledTimes(1);

    unsubscribeRegion();
  });

  it('notifies translation subscribers for matching cache updates', async () => {
    const manager = installManager();
    installConditionStore('en');
    const externalStore = new I18nExternalStore();
    const matchingListener = vi.fn();
    const otherHashListener = vi.fn();
    const otherLocaleListener = vi.fn();

    const unsubscribeMatching = externalStore.subscribeToTranslation(
      {
        locale: 'fr',
        message: 'Hello',
        options: { $format: 'ICU', $_hash: 'hash' },
      },
      matchingListener
    );
    const unsubscribeOtherHash = externalStore.subscribeToTranslation(
      {
        locale: 'fr',
        message: 'Other',
        options: { $format: 'ICU', $_hash: 'other' },
      },
      otherHashListener
    );
    const unsubscribeOtherLocale = externalStore.subscribeToTranslation(
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

  it('notifies dictionary entry subscribers for matching cache misses', async () => {
    const manager = installManager();
    installConditionStore('en');
    const externalStore = new I18nExternalStore();
    const matchingListener = vi.fn();
    const otherListener = vi.fn();

    const unsubscribeMatching =
      externalStore.subscribeToDictionaryEntry(
        { locale: 'fr', id: 'greeting' },
        matchingListener
      );
    const unsubscribeOther =
      externalStore.subscribeToDictionaryEntry(
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
    const manager = installManager();
    installConditionStore('en');
    const externalStore = new I18nExternalStore();
    const matchingListener = vi.fn();
    const otherListener = vi.fn();

    const unsubscribeMatching =
      externalStore.subscribeToDictionaryObject(
        { locale: 'fr', id: 'user.profile' },
        matchingListener
      );
    const unsubscribeOther =
      externalStore.subscribeToDictionaryObject(
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
