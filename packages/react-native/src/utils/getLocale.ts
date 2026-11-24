import { getI18nConfig } from '@generaltranslation/react-core/pure';
import { getI18nConfig as getBaseI18nConfig } from 'gt-i18n/internal';
import { getNativeLocales } from './getNativeLocales';
import { nativeStoreGet } from './nativeStore';

export type GetLocaleParams = {
  localeStoreKey?: string;
};

/** The saved locale, then the device's languages. */
export function readNativeLocales(localeStoreKey: string): string[] {
  const savedLocale = nativeStoreGet(localeStoreKey);
  return [...(savedLocale ? [savedLocale] : []), ...getNativeLocales()];
}

/**
 * @internal
 */
export function getLocale({
  localeStoreKey = getI18nConfig().getLocaleCookieName(),
}: GetLocaleParams = {}): string {
  return getBaseI18nConfig().resolveSupportedLocale(
    readNativeLocales(localeStoreKey)
  );
}
