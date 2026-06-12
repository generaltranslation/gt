import type {
  AsyncReadonlyConditionStoreInterface,
  ReadonlyConditionStoreInterface,
} from '../i18n-cache/types';

type I18nGlobals = {
  conditionStore?: ReadonlyConditionStoreInterface;
  gtServicesEnabled?: boolean | undefined;
  [key: string]: unknown;
};

type GeneralTranslationGlobal = {
  i18n?: I18nGlobals;
  [key: string]: unknown;
};

type GlobalWithGeneralTranslation = {
  __generaltranslation?: GeneralTranslationGlobal;
};

function getI18nGlobals(): I18nGlobals {
  const globalObj = globalThis as unknown as GlobalWithGeneralTranslation;
  globalObj.__generaltranslation ??= {};
  // TODO: Consider checking package versions and using a compatibility matrix before sharing global singletons.
  globalObj.__generaltranslation.i18n ??= {};
  return globalObj.__generaltranslation.i18n;
}

export function createConditionStoreSingleton<
  T extends
    | ReadonlyConditionStoreInterface
    | AsyncReadonlyConditionStoreInterface,
>(notInitializedMessage: string) {
  function getConditionStore(): T {
    /**
     * TODO: each package throws a different error message
     */
    const conditionStore = getI18nGlobals().conditionStore;
    if (!conditionStore) {
      throw new Error(notInitializedMessage);
    }
    return conditionStore as T;
  }

  function setConditionStore(nextConditionStore: T): void {
    const i18nGlobals = getI18nGlobals();
    if (
      i18nGlobals.conditionStore &&
      i18nGlobals.conditionStore !== nextConditionStore
    ) {
      console.warn(
        'gt-i18n: Overwriting global conditionStore singleton instance.'
      );
    }
    i18nGlobals.conditionStore =
      nextConditionStore as ReadonlyConditionStoreInterface;
  }

  function isConditionStoreInitialized(): boolean {
    return getI18nGlobals().conditionStore !== undefined;
  }

  return {
    getConditionStore,
    setConditionStore,
    isConditionStoreInitialized,
  };
}
