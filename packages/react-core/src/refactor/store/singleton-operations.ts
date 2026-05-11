import type { I18nStore } from "./I18nExternalStore";

let i18nExternalStore: I18nStore | undefined;

export function getI18nExternalStore(): I18nStore {
  if (!i18nExternalStore) {
    throw new Error(
      "I18nExternalStore is not initialized. Render GTProvider before using external-store hooks.",
    );
  }
  return i18nExternalStore;
}

export function setI18nExternalStore(nextStore: I18nStore): void {
  i18nExternalStore = nextStore;
}
