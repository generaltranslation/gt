import { createGlobalSingleton } from '../globals/createGlobalSingleton';
import type {
  AsyncReadonlyConditionStoreInterface,
  ReadonlyConditionStoreInterface,
} from '../i18n-cache/types';

export function createConditionStoreSingleton<
  T extends
    | ReadonlyConditionStoreInterface
    | AsyncReadonlyConditionStoreInterface,
>(notInitializedMessage: string) {
  const singleton = createGlobalSingleton<T>({
    namespace: 'i18n',
    key: 'conditionStore',
    source: 'gt-i18n',
    notInitialized: () => notInitializedMessage,
  });

  return {
    getConditionStore: singleton.get,
    setConditionStore: singleton.set,
    isConditionStoreInitialized: singleton.isInitialized,
  };
}
