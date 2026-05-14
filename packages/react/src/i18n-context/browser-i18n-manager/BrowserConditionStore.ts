import { defaultLocaleCookieName } from "@generaltranslation/react-core/internal";
import { setCookieValue } from "./utils/cookies";
import { determineLocale } from "./utils/determineLocale";
import { GetLocale } from "./utils/types";
import type {
  ConditionStoreConfig,
  WritableConditionStore,
} from "gt-i18n/internal/types";

type StoreListener = () => void;
type Unsubscribe = () => void;

/**
 * The configuration for the BrowserConditionStore
 * @param {string[]} locales - The accepted locales
 * @param {CustomMapping} [customMapping] - The custom mapping
 * @param {GetLocale} getLocale - The function to get the locale
 * @param {string} [localeCookieName=defaultLocaleCookieName] - The name of the locale cookie to check
 */
type BrowserConditionStoreConstructorParams = ConditionStoreConfig & {
  getLocale?: GetLocale;
  localeCookieName?: string;
};

/**
 * Condition store implementation for Browser.
 */
export class BrowserConditionStore implements WritableConditionStore {
  private listeners = new Set<StoreListener>();
  private localeConfig: ConditionStoreConfig;
  private customGetLocale?: GetLocale;
  private localeCookieName: string;

  /**
   * @param {BrowserConditionStoreConstructorParams} params - The configuration for the BrowserConditionStore
   */
  constructor({
    getLocale,
    localeCookieName = defaultLocaleCookieName,
    ...localeConfig
  }: BrowserConditionStoreConstructorParams = {}) {
    this.localeConfig = localeConfig;
    this.customGetLocale = getLocale;
    this.localeCookieName = localeCookieName;
  }

  /**
   * Get the current locale.
   */
  getLocale(): string {
    return determineLocale({
      ...this.localeConfig,
      getLocale: this.customGetLocale,
      localeCookieName: this.localeCookieName,
    });
  }

  setLocale(locale: string): void {
    const previousLocale = this.getLocale();
    setCookieValue({
      cookieName: this.localeCookieName,
      value: locale,
    });
    const nextLocale = this.getLocale();
    if (nextLocale !== previousLocale) {
      this.emitLocaleChange();
    }
  }

  subscribeToLocale(listener: StoreListener): Unsubscribe {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private emitLocaleChange(): void {
    this.listeners.forEach((listener) => listener());
  }
}
