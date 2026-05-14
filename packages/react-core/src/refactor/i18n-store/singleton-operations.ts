import { I18nStore } from "./I18nStore";

// ===== I18n Store ===== //

let i18nStore: I18nStore | undefined;

export function getI18nStore(): I18nStore {
  if (!i18nStore) {
    throw new Error("I18nExternalStore is not initialized.");
  }
  return i18nStore;
}

export function setI18nStore(nextStore: I18nStore): void {
  i18nStore?.disconnect();
  i18nStore = nextStore;
}
