import type { ReadonlyConditionStoreInterface as ReadonlyConditionStoreContract } from '../i18n-cache/types';
import type { LocaleCandidates } from '../i18n-config/I18nConfig';
import { getI18nConfig } from '../i18n-config/singleton-operations';

export type ReadonlyConditionStoreParams = {
  locale: LocaleCandidates;
  region?: string;
  enableI18n?: boolean;
};

export class ReadonlyConditionStore implements ReadonlyConditionStoreContract {
  protected locale: string;
  protected region?: string;
  protected enableI18n: boolean;

  constructor({
    locale,
    region,
    enableI18n = true,
  }: ReadonlyConditionStoreParams) {
    const i18nConfig = getI18nConfig();
    this.locale =
      i18nConfig.determineLocale(locale) || i18nConfig.getDefaultLocale();
    this.region = region;
    this.enableI18n = enableI18n;
  }

  getLocale = (): string => {
    return this.locale;
  };

  getRegion = (): string | undefined => {
    return this.region;
  };

  getEnableI18n = (): boolean => {
    return this.enableI18n;
  };

  // --- no-op methods --- //

  setLocale = (locale: LocaleCandidates): void => {};

  setRegion = (region: string | undefined): void => {};

  setEnableI18n = (enableI18n: boolean): void => {};
}
