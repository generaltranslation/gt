import { CustomMapping } from 'generaltranslation/types';
import type {
  LocaleResolverConfig,
  ReadonlyConditionStoreInterface as ReadonlyConditionStoreContract,
} from '../i18n-cache/types';
import { createLocaleResolver, type LocaleCandidates } from './localeResolver';

export type ReadonlyConditionStoreParams = {
  /**
   * @deprecated - this will be moved to a locale config cache
   */
  defaultLocale?: string;
  /**
   * @deprecated - this will be moved to a locale config cache
   */
  locales?: string[];
  /**
   * @deprecated - this will be moved to a locale config cache
   */
  customMapping?: CustomMapping;
  locale: LocaleCandidates;
  enableI18n?: boolean;
};

export class ReadonlyConditionStore implements ReadonlyConditionStoreContract {
  /**
   * @deprecated use I18nConfig instead
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
     * TODO: change this to I18nConfig once condition stores are migrated.
     */
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

  // --- no-op methods --- //

  setLocale = (locale: LocaleCandidates): void => {};

  setEnableI18n = (enableI18n: boolean): void => {};
}
