import type { WritableConditionStore } from "gt-i18n/internal/types";
import { getI18nManager } from "../i18n-manager/singleton-operations";
import { ReactI18nManager } from "../i18n-manager/ReactI18nManager";

export type ReactConditionStoreParams = {
  locale: string;
  enableI18n?: boolean;
};

/**
 * TODO: consider moving to /i18n, nothing about this seems specific to react only
 */
export class ReactConditionStore implements WritableConditionStore {
  private locale: string;
  private enableI18n: boolean;

  constructor({ locale, enableI18n = true }: ReactConditionStoreParams) {
    let i18nManager: ReactI18nManager;
    try {
      i18nManager = getI18nManager();
    } catch (error) {
      throw new Error(
        "Failed to initialize ReactConditionStore. Reason: " + error,
      );
    }
    this.locale = i18nManager.determineLocale(locale);
    this.enableI18n = enableI18n;
  }

  getLocale = (): string => {
    return this.locale;
  };

  setLocale = (locale: string): void => {
    this.locale = getI18nManager().determineLocale(locale);
  };

  getEnableI18n = (): boolean => {
    return this.enableI18n;
  };

  setEnableI18n = (enableI18n: boolean): void => {
    this.enableI18n = enableI18n;
  };
}
