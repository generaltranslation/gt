import {
  createGT,
  createMessages,
  type CreateGTParams,
  type ReadonlyConditionStoreInterface,
} from 'gt-i18n/internal';
import type { GT, M } from 'gt-i18n';

type Conditions = { locale: string; enableI18n: boolean };

/**
 * The translation functions, bound to where an entry reads the locale (the
 * request on the server, the browser store in the browser) and how it loads
 * translations. Loaders run on both sides, so both entries export the same
 * functions. Each entry documents its exports, since declaration files drop
 * the docs of destructured values.
 */
export function createRuntime(
  getStore: () => ReadonlyConditionStoreInterface,
  loadParams: (conditions: Conditions) => Promise<CreateGTParams>
) {
  const getLocale = (): string => getStore().getLocale();
  const getEnableI18n = (): boolean => getStore().getEnableI18n();
  const getConditions = (): Conditions => ({
    locale: getLocale(),
    enableI18n: getEnableI18n(),
  });
  return {
    getLocale,
    getEnableI18n,
    getGT: async (): Promise<GT> => createGT(await loadParams(getConditions())),
    getMessages: async (): Promise<M> =>
      createMessages(await loadParams(getConditions())),
  };
}
