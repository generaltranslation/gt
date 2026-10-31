import type { GT } from 'gt-i18n/unstable';
import { getGT } from 'gt-i18n/unstable/internal';
import type { ReadonlyConditionStoreInterface } from 'gt-i18n/internal/types';

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
