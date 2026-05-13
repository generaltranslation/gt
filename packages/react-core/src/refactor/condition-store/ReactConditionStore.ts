import type {
  LocaleResolverConfig,
  WritableConditionStore,
  LocaleCandidates,
} from "gt-i18n/internal/types";
import { createLocaleResolver } from "gt-i18n/internal";
import { getI18nManager } from "../i18n-manager/singleton-operations";
import { ReactI18nManager } from "../i18n-manager/ReactI18nManager";

/**
 * We want to include LocaleResolverConfig because at runtime,
 * its possible the user may change their supported locales
 * could potentially have ramifications for the i18nManager's tx cache,
 * but its good to support this customization in the GTProvider
 */
export type ReactConditionStoreParams = LocaleResolverConfig & {
  locale: string;
  enableI18n?: boolean;
};

export class ReactConditionStore implements WritableConditionStore {
  private locale: string;
  private enableI18n: boolean;
  protected resolveLocale: (candidates?: LocaleCandidates) => string;

  constructor({
    defaultLocale,
    locale,
    locales,
    customMapping,
    enableI18n = true,
  }: ReactConditionStoreParams) {
    let i18nManager: ReactI18nManager;
    try {
      i18nManager = getI18nManager();
    } catch (error) {
      throw new Error(
        "Failed to initialize ReactConditionStore. Reason: " + error,
      );
    }
    this.resolveLocale = createLocaleResolver({
      defaultLocale: defaultLocale ?? i18nManager.getDefaultLocale(),
      locales: locales ?? i18nManager.getLocales(),
      customMapping: customMapping ?? i18nManager.getCustomMapping(),
    });
    this.locale = this.resolveLocale(locale);
    this.enableI18n = enableI18n;
  }

  getLocale = (): string => {
    return this.locale;
  };

  setLocale = (locale: string): void => {
    this.locale = this.resolveLocale(locale);
  };

  getEnableI18n = (): boolean => {
    return this.enableI18n;
  };

  setEnableI18n = (enableI18n: boolean): void => {
    this.enableI18n = enableI18n;
  };
}
