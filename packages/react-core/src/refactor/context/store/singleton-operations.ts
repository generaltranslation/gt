import { I18nManagerConstructorParams } from "gt-i18n/internal/types";
import { I18nStore } from "./I18nStore";
import { Translation } from "gt-i18n/types";

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

export function initializeI18nStore({
  reloadServerSideProps,
}: {
  reloadServerSideProps?: () => void;
}): void {
  if (i18nStore) {
    throw new Error("I18nStore already initialized.");
  }
  i18nStore = new I18nStore({
    reloadServerSideProps,
  });
}
