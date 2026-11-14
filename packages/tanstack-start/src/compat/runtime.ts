import type { ReadonlyConditionStoreInterface } from 'gt-i18n/internal';
import {
  getTranslationsInternal,
  type TFunctionType,
} from 'gt-i18n/internal/compat';

/**
 * The dictionary translation function, bound to where an entry reads the
 * locale, like the native createRuntime() functions.
 */
export function createGetTranslations(
  getStore: () => ReadonlyConditionStoreInterface,
  ensureDictionaryManager: () => void
): (rootId?: string) => Promise<TFunctionType> {
  return (rootId) => {
    ensureDictionaryManager();
    return getTranslationsInternal({
      locale: getStore().getLocale(),
      enableI18n: getStore().getEnableI18n(),
      rootId,
    });
  };
}
