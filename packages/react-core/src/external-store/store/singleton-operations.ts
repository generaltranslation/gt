import type { I18nExternalStore } from './I18nExternalStore';

let i18nExternalStore: I18nExternalStore | undefined;

export function getI18nExternalStore(): I18nExternalStore {
  if (!i18nExternalStore) {
    throw new Error(
      'I18nExternalStore is not initialized. Render GTProvider before using external-store hooks.'
    );
  }
  return i18nExternalStore;
}

export function setI18nExternalStore(nextStore: I18nExternalStore): void {
  i18nExternalStore = nextStore;
}
