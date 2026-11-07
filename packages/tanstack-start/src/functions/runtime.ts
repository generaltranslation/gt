import {
  getGTInternal,
  getMessagesInternal,
  type ReadonlyConditionStoreInterface,
} from 'gt-i18n/internal';
import type { GTFunctionType, MFunctionType, Message } from 'gt-i18n';

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
  };
}
