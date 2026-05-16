import type {
  LocaleResolverConfig,
  ReadonlyConditionStoreInterface as ReadonlyConditionStoreContract,
} from "../i18n-manager/types";
import { createLocaleResolver, type LocaleCandidates } from "./localeResolver";

export type ReadonlyConditionStoreParams = LocaleResolverConfig & {
  locale: LocaleCandidates;
  enableI18n?: boolean;
};

export class ReadonlyConditionStore implements ReadonlyConditionStoreContract {
  /**
   * @deprecated use getI18nManager().determineLocale() instead
   */
  protected readonly resolveLocale: (candidates?: LocaleCandidates) => string;
  protected locale: string;
  protected enableI18n: boolean;

  constructor({
    locale,
    enableI18n = true,
    ...localeConfig
  }: ReadonlyConditionStoreParams) {
    /**
     * TODO: change this to getI18nManager().determineLocale() but this
     * currently creates a circular dependency
     */
    const { defaultLocale, locales, customMapping } = localeConfig;
    console.log("ReadonlyConditionStore", locale, {
      defaultLocale,
      locales,
      customMapping,
    });
    this.resolveLocale = createLocaleResolver(localeConfig);
    this.locale = this.resolveLocale(locale);
    console.log("ReadonlyConditionStore.locale 2", this.locale);
    this.enableI18n = enableI18n;
  }

  getLocale = (): string => {
    console.log("ReadonlyConditionStore.getLocale", this.locale);
    return this.locale;
  };

  getEnableI18n = (): boolean => {
    return this.enableI18n;
  };

  // --- no-op methods --- //

  setLocale = (locale: LocaleCandidates): void => {};

  setEnableI18n = (enableI18n: boolean): void => {};
}
