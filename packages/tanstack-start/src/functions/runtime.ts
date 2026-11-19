import {
  getGT,
  getMessages,
  type ReadonlyConditionStoreInterface,
} from 'gt-i18n/internal';
import type { GT, M } from 'gt-i18n';

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
    getGT: (): Promise<GT> =>
      getGT({ locale: getLocale(), enableI18n: getEnableI18n() }),
    getMessages: (): Promise<M> =>
      getMessages({ locale: getLocale(), enableI18n: getEnableI18n() }),
  };
}
