import type {
  LocaleResolverConfig,
  WritableConditionStore as WritableConditionStoreContract,
} from '../types';
import {
  createLocaleResolver,
  type LocaleCandidates,
} from './localeResolver';

export type WritableConditionStoreParams = LocaleResolverConfig & {
  locale?: LocaleCandidates;
  enableI18n?: boolean;
};

export class WritableConditionStore implements WritableConditionStoreContract {
  private readonly resolveLocale: (candidates?: LocaleCandidates) => string;
  private locale: string;
  private enableI18n: boolean;

  constructor({
    locale,
    enableI18n = true,
    ...localeConfig
  }: WritableConditionStoreParams = {}) {
    this.resolveLocale = createLocaleResolver(localeConfig);
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
