import {
  getTranslationsInternal,
  type ReadonlyConditionStoreInterface,
} from 'gt-i18n/internal';
import type { TFunctionType } from 'gt-i18n';

/**
 * The dictionary translation function, bound to where an entry reads the
 * locale, like the native createRuntime() functions.
 */
export function createGetTranslations(
  getStore: () => ReadonlyConditionStoreInterface
): (rootId?: string) => Promise<TFunctionType> {
  return (rootId) =>
    getTranslationsInternal({
      locale: getStore().getLocale(),
      enableI18n: getStore().getEnableI18n(),
      rootId,
    });
}
