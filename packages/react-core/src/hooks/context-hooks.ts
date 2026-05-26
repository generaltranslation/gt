import { getI18nManager, getRuntimeEnvironment } from "gt-i18n/internal";
import { getReadonlyConditionStore } from "../condition-store/singleton-operations";
import { ReadonlyConditionStoreInterface } from "gt-i18n/internal/types";

function getConditionStoreSafe(
  property: string,
): ReadonlyConditionStoreInterface | undefined {
  try {
    return getReadonlyConditionStore();
  } catch {
    const message = `@generaltranslation/react-core: Cannot access ${property} before the condition store has been initialized. Make sure to add a <GTProvider> at the top of your component tree to initialize the condition store.`;
    if (getRuntimeEnvironment() === "development") {
      throw new Error(message);
    } else {
      console.warn(message);
    }
    return undefined;
  }
}

export function useLocale(): string {
  return getLocale();
}

export function getLocale(): string {
  const conditionStore = getConditionStoreSafe("locale");
  // TODO: centralize locale logic
  if (!conditionStore) return getI18nManager().getDefaultLocale();
  return conditionStore.getLocale();
}

/**
 * @deprecated only should be implemented in browser/RN environments
 *
 * This is because this function is not generalizable to all react environments
 * Remember, server environments are read only
 */
export function useSetLocale(locale: string) {
  throw new Error(
    "useSetLocale is not implemented in @generaltranslation/react-core",
  );
}

export function useEnableI18n(): boolean {
  const conditionStore = getConditionStoreSafe("enableI18n");
  if (!conditionStore) return true;
  return conditionStore.getEnableI18n();
}

/**
 * @deprecated only should be implemented in browser/RN environments
 *
 * This is because this function is not generalizable to all react environments
 * Remember, server environments are read only
 */
export function useSetEnableI18n(enableI18n: boolean) {
  throw new Error(
    "useSetEnableI18n is not implemented in @generaltranslation/react-core",
  );
}
