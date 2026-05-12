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
  i18nEnabled?: boolean;
};

export class ReactConditionStore implements WritableConditionStore {
  private defaultLocale: string;
  private locale: string;
  private i18nEnabled: boolean;
  private resolveLocale: (candidates?: LocaleCandidates) => string;

  constructor({
    defaultLocale,
    locale,
    locales,
    customMapping,
    i18nEnabled = true,
  }: ReactConditionStoreParams) {
    let i18nManager: ReactI18nManager;
    try {
      i18nManager = getI18nManager();
    } catch (error) {
      throw new Error(
        "Failed to initialize ReactConditionStore. Reason: " + error,
      );
    }
    this.defaultLocale = defaultLocale ?? i18nManager.getDefaultLocale();
    this.resolveLocale = createLocaleResolver({
      defaultLocale: this.defaultLocale,
      locales: locales ?? i18nManager.getLocales(),
      customMapping: customMapping ?? i18nManager.getCustomMapping(),
    });
    this.locale = this.resolveLocale(locale);
    this.i18nEnabled = i18nEnabled;
  }

  getLocale = (): string => {
    return this.locale ?? this.defaultLocale;
  };

  setLocale = (locale: string): void => {
    this.locale = this.resolveLocale(locale);
  };

  getI18nEnabled = (): boolean => {
    return this.i18nEnabled;
  };

  setI18nEnabled = (i18nEnabled: boolean): void => {
    this.i18nEnabled = i18nEnabled;
  };
}
