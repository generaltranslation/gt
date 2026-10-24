import {
  getGTInternal,
  getMessagesInternal,
  getTranslationsInternal,
} from 'gt-i18n/internal';
import type { ReadonlyConditionStoreInterface } from 'gt-i18n/internal/types';
import type {
  GTFunctionType,
  MFunctionType,
  Message,
  TFunctionType,
} from 'gt-i18n/types';

/**
 * The translation functions, bound to where an entry reads the locale: the
 * request on the server, the browser store in the browser. Loaders run on
 * both sides, so both entries export the same functions. Each entry documents
 * its exports, since declaration files drop the docs of destructured values.
 */
export function createRuntime(getStore: () => ReadonlyConditionStoreInterface) {
  const getLocale = (): string => getStore().getLocale();
  const getEnableI18n = (): boolean => getStore().getEnableI18n();
  return {
    getLocale,
    getEnableI18n,
    getGT: (messages?: Message[]): Promise<GTFunctionType> =>
      getGTInternal(
        { locale: getLocale(), enableI18n: getEnableI18n() },
        messages
      ),
    getMessages: (): Promise<MFunctionType> =>
      getMessagesInternal({ locale: getLocale(), enableI18n: getEnableI18n() }),
    getTranslations: (rootId?: string): Promise<TFunctionType> =>
      getTranslationsInternal({
        locale: getLocale(),
        enableI18n: getEnableI18n(),
        rootId,
      }),
  };
}
