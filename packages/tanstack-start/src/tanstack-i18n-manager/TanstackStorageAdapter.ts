import { StorageAdapter } from 'gt-i18n/internal';
import { determineLocale } from '../functions/determineLocale';
import { CustomMapping } from 'generaltranslation/types';

const TANSTACK_I18N_STORAGE_ADAPTER_TYPE =
  'tanstack-i18n-storage-adapter' as const;

type TanstackStorageAdapterConstructorParams = {
  defaultLocale: string;
  locales: string[];
  customMapping?: CustomMapping;
};

/**
 * StorageAdapter implementation for Tanstack Start.
 */
export class TanstackStorageAdapter extends StorageAdapter {
  readonly type = TANSTACK_I18N_STORAGE_ADAPTER_TYPE;
  private defaultLocale: string;
  private locales: string[];
  private customMapping?: CustomMapping;

  constructor({
    defaultLocale,
    locales,
    customMapping,
  }: TanstackStorageAdapterConstructorParams) {
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
    if (key === 'locale') {
      return determineLocale({
        defaultLocale: this.defaultLocale,
        locales: this.locales,
        customMapping: this.customMapping,
      });
    }
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
