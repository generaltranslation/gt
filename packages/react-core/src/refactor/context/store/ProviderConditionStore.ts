import { createLocaleResolver } from "gt-i18n/internal";
import type {
  I18nExternalConditionStore,
  ListenerSet,
  StoreListener,
  Unsubscribe,
} from "./storeTypes";
import type {
  ConditionStoreConfig,
  LocaleCandidates,
  WritableConditionStore,
} from "gt-i18n/internal/types";

export type ProviderConditionStoreParams = ConditionStoreConfig & {
  locale?: string;
  region?: string;
  getLocale?: () => string | undefined;
};

/**
 * Condition store implementation owned by GTProvider.
 *
 * This follows the gt-i18n condition-store model: the store owns locale
 * resolution, setters update the underlying condition source, and subscribers
 * receive value-less notifications so React can reread snapshots.
 */
export class ProviderConditionStore
  implements WritableConditionStore, I18nExternalConditionStore
{
  // ===== State ===== //

  private locale: string | undefined;
  private region: string | undefined;
  private resolveLocale: (candidates?: LocaleCandidates) => string;
  private customGetLocale: (() => string | undefined) | undefined;

  // ===== Listener Sets ===== //

  private localeListeners: ListenerSet = new Set();
  private regionListeners: ListenerSet = new Set();

  constructor({
    defaultLocale,
    locales,
    customMapping,
    locale,
    region,
    getLocale,
  }: ProviderConditionStoreParams = {}) {
    this.locale = locale;
    this.region = region;
    this.customGetLocale = getLocale;
    this.resolveLocale = createLocaleResolver({
      defaultLocale,
      locales,
      customMapping,
    });
  }

  // ===== Locale ===== //

  getLocale = (): string => {
    return this.resolveLocale(this.customGetLocale?.() ?? this.locale);
  };

  setLocale = (locale: string): void => {
    const previousLocale = this.getLocale();
    this.locale = locale;
    const nextLocale = this.getLocale();
    if (nextLocale !== previousLocale) {
      emit(this.localeListeners);
    }
  };

  subscribeToLocale = (listener: StoreListener): Unsubscribe => {
    return subscribeToSet(this.localeListeners, listener);
  };

  // ===== Region ===== //

  getRegion = (): string | undefined => {
    return this.region;
  };

  setRegion = (region: string | undefined): void => {
    const previousRegion = this.region;
    this.region = region;
    if (this.region !== previousRegion) {
      emit(this.regionListeners);
    }
  };

  subscribeToRegion = (listener: StoreListener): Unsubscribe => {
    return subscribeToSet(this.regionListeners, listener);
  };
}

// ===== Utilities ===== //

function subscribeToSet(
  listenerSet: ListenerSet,
  listener: StoreListener,
): Unsubscribe {
  listenerSet.add(listener);
  return () => {
    listenerSet.delete(listener);
  };
}

function emit(listenerSet: ListenerSet): void {
  listenerSet.forEach((listener) => listener());
}
