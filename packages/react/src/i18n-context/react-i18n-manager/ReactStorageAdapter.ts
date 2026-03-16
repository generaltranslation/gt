import { StorageAdapter } from 'gt-i18n/internal';
// import { determineLocale } from '../functions/determineLocale';
import { CustomMapping } from 'generaltranslation/types';

const REACT_I18N_STORAGE_ADAPTER_TYPE = 'react-i18n-storage-adapter' as const;

type ReactStorageAdapterConstructorParams = {
  defaultLocale: string;
  locales: string[];
  customMapping?: CustomMapping;
};

/**
 * StorageAdapter implementation for React.
 */
export class ReactStorageAdapter extends StorageAdapter {
  readonly type = REACT_I18N_STORAGE_ADAPTER_TYPE;
  private defaultLocale: string;
  private locales: string[];
  private customMapping?: CustomMapping;

  constructor({
    defaultLocale,
    locales,
    customMapping,
  }: ReactStorageAdapterConstructorParams) {
    super();
    this.defaultLocale = defaultLocale;
    this.locales = locales;
    this.customMapping = customMapping;
  }

  /**
   * This only supports
   * @param key
   * @returns
   */
  getItem(key: string): string | undefined {
    // if (key === 'locale') {
    //   return determineLocale({
    //     defaultLocale: this.defaultLocale,
    //     locales: this.locales,
    //     customMapping: this.customMapping,
    //   });
    // }
    return undefined;
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars, no-unused-vars
  setItem(key: string, value: string): void {
    // noop
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars, no-unused-vars
  removeItem(key: string): void {
    // noop
  }
}
