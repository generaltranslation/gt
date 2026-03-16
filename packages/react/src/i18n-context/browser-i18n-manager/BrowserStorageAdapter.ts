import { StorageAdapter } from 'gt-i18n/internal';
import { CustomMapping } from 'generaltranslation/types';
import { defaultLocaleCookieName } from '@generaltranslation/react-core/internal';
import { setCookieValue } from './utils/cookies';
import { determineLocale } from './utils/determineLocale';
import { GetLocale } from './utils/types';

const BROWSER_I18N_STORAGE_ADAPTER_TYPE =
  'browser-i18n-storage-adapter' as const;

/**
 * The configuration for the BrowserStorageAdapter
 * @param {string[]} locales - The accepted locales
 * @param {CustomMapping} [customMapping] - The custom mapping
 * @param {GetLocale} getLocale - The function to get the locale
 * @param {string} [localeCookieName=defaultLocaleCookieName] - The name of the locale cookie to check
 */
type BrowserStorageAdapterConstructorParams = {
  defaultLocale: string;
  locales: string[];
  customMapping?: CustomMapping;
  getLocale?: GetLocale;
  localeCookieName?: string;
};

/**
 * StorageAdapter implementation for Browser.
 */
export class BrowserStorageAdapter extends StorageAdapter {
  readonly type = BROWSER_I18N_STORAGE_ADAPTER_TYPE;
  private defaultLocale: string;
  private locales: string[];
  private customMapping?: CustomMapping;
  private getLocale?: GetLocale;
  private localeCookieName: string;

  /**
   * @param {BrowserStorageAdapterConstructorParams} params - The configuration for the BrowserStorageAdapter
   */
  constructor({
    defaultLocale,
    locales,
    customMapping,
    getLocale,
    localeCookieName = defaultLocaleCookieName,
  }: BrowserStorageAdapterConstructorParams) {
    super();
    this.defaultLocale = defaultLocale;
    this.locales = locales;
    this.customMapping = customMapping;
    this.getLocale = getLocale;
    this.localeCookieName = localeCookieName;
  }

  /**
   * This only supports locale key
   * @param key
   * @returns
   */
  getItem(key: string): string | undefined {
    if (key === 'locale') {
      const locale = determineLocale({
        defaultLocale: this.defaultLocale,
        locales: this.locales,
        customMapping: this.customMapping,
        getLocale: this.getLocale,
        localeCookieName: this.localeCookieName,
      });
      return locale;
    }
    return undefined;
  }

  setItem(key: string, value: string): void {
    if (key === 'locale') {
      setCookieValue({
        cookieName: this.localeCookieName,
        value,
      });
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars, no-unused-vars
  removeItem(key: string): void {
    // noop
  }
}
