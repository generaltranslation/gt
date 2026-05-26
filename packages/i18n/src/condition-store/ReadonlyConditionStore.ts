import type { ReadonlyConditionStoreInterface as ReadonlyConditionStoreContract } from '../i18n-cache/types';
import { getI18nConfig } from '../i18n-config/singleton-operations';
import type { LocaleCandidates } from './localeResolver';

export type ReadonlyConditionStoreParams = {
  locale: LocaleCandidates;
  enableI18n?: boolean;
};

export class ReadonlyConditionStore implements ReadonlyConditionStoreContract {
  protected locale: string;
  protected enableI18n: boolean;

  constructor({ locale, enableI18n = true }: ReadonlyConditionStoreParams) {
    this.locale = getI18nConfig().resolveSupportedLocale(locale);
    this.enableI18n = enableI18n;
  }

  getLocale = (): string => {
    return this.locale;
  };

  getEnableI18n = (): boolean => {
    return this.enableI18n;
  };

  // --- no-op methods --- //

  setLocale = (locale: LocaleCandidates): void => {};

  setEnableI18n = (enableI18n: boolean): void => {};
}
