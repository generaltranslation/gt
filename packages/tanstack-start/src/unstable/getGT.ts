import type { GT, M } from 'gt-i18n/unstable';
import { getGT, getMessages } from 'gt-i18n/unstable/internal';
import type { ReadonlyConditionStoreInterface } from 'gt-i18n/internal';

/** Binds the tagged getGT() to where an entry reads the locale, like createRuntime. */
export function createUnstableGetGT(
  getStore: () => ReadonlyConditionStoreInterface
): () => Promise<GT> {
  return () => {
    const store = getStore();
    return getGT({
      locale: store.getLocale(),
      enableI18n: store.getEnableI18n(),
    });
  };
}

/** Binds the getMessages() of msg() messages like createUnstableGetGT. */
export function createUnstableGetMessages(
  getStore: () => ReadonlyConditionStoreInterface
): () => Promise<M> {
  return () => {
    const store = getStore();
    return getMessages({
      locale: store.getLocale(),
      enableI18n: store.getEnableI18n(),
    });
  };
}
