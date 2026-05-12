import {
  ReactI18nManager,
  ReactI18nManagerConstructorParams,
} from "./ReactI18nManager";
import {
  getI18nManager as getI18nManagerInternal,
  setI18nManager as setI18nManagerInternal,
} from "gt-i18n/internal";

// ===== I18n Manager ===== //

export function getI18nManager(): ReactI18nManager {
  return getI18nManagerInternal() as ReactI18nManager;
}

export function setI18nManager(i18nManager: ReactI18nManager): void {
  setI18nManagerInternal(i18nManager);
}

// ===== Initialize State ===== //

/**
 * Hard requires the existance of initialTranslations and a locale
 */
export function initializeState({
  locale,
  config,
}: {
  locale: string;
  config: ReactI18nManagerConstructorParams;
}): void {
  const i18nManager = new ReactI18nManager(config);
  setI18nManager(i18nManager);
}
