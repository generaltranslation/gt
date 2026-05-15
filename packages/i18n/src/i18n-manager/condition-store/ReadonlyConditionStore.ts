import type {
  LocaleResolverConfig,
  ReadonlyConditionStore as ReadonlyConditionStoreContract,
} from "../types";
import { createLocaleResolver, type LocaleCandidates } from "./localeResolver";

export type ReadonlyConditionStoreParams = LocaleResolverConfig & {
  locale: LocaleCandidates;
  enableI18n?: boolean;
};

export class ReadonlyConditionStore implements ReadonlyConditionStoreContract {
  protected readonly resolveLocale: (candidates?: LocaleCandidates) => string;
  protected locale: string;
  protected enableI18n: boolean;

  constructor({
    locale,
    enableI18n = true,
    ...localeConfig
  }: ReadonlyConditionStoreParams) {
    this.resolveLocale = createLocaleResolver(localeConfig);
    this.locale = this.resolveLocale(locale);
    this.enableI18n = enableI18n;
  }

  getLocale = (): string => {
    return this.locale;
  };

  getEnableI18n = (): boolean => {
    return this.enableI18n;
  };
}
