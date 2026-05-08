import { getCurrentLocale } from 'gt-i18n/internal';
import type { StoreListener, Unsubscribe } from '../storeTypes';

export type I18nExternalConditionStore = {
  getLocale(): string;
  subscribeToLocale(listener: StoreListener): Unsubscribe;
  setLocale?(locale: string): void;
  getRegion?(): string | undefined;
  subscribeToRegion?(listener: StoreListener): Unsubscribe;
  setRegion?(region: string | undefined): void;
};

let conditionStore: I18nExternalConditionStore | undefined;

/**
 * Register the runtime condition source that can notify React about updates.
 *
 * gt-i18n still owns translation resolution. This adapter only gives React a
 * subscribable source for client-side condition changes.
 */
export function setI18nExternalConditionStore(
  nextConditionStore: I18nExternalConditionStore
): void {
  conditionStore = nextConditionStore;
}

export function getLocaleSnapshot(): string {
  return conditionStore?.getLocale() ?? getCurrentLocale();
}

export function subscribeToLocale(listener: StoreListener): Unsubscribe {
  return conditionStore?.subscribeToLocale(listener) ?? (() => {});
}

export function setLocale(locale: string): void {
  if (!conditionStore?.setLocale) {
    throw new Error(
      'setLocale(): Unable to update locale because the active condition store is not writable.'
    );
  }
  conditionStore.setLocale(locale);
}

export function getRegionSnapshot(): string | undefined {
  return conditionStore?.getRegion?.();
}

export function subscribeToRegion(listener: StoreListener): Unsubscribe {
  return conditionStore?.subscribeToRegion?.(listener) ?? (() => {});
}

export function setRegion(region: string | undefined): void {
  if (!conditionStore?.setRegion) {
    throw new Error(
      'setRegion(): Unable to update region because the active condition store is not writable.'
    );
  }
  conditionStore.setRegion(region);
}
