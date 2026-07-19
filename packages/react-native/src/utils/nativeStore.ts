import { Platform } from 'react-native';
import { getI18nConfig } from '@generaltranslation/react-core/pure';
import { GtReactNative } from '../NativeGtReactNative';
import { ssrUnsupportedWarning } from '../errors-dir/warnings';

/**
 * Get the locale from the native store.
 *
 * This reads persisted native storage directly, so it can temporarily be out of
 * sync with React state while a locale change is in progress.
 *
 * Defaults to the store key configured through initializeGT().
 *
 * @param key - The key to get the locale from
 * @returns The locale from the native store
 */
export function getLocaleFromNativeStore(
  key = getI18nConfig().getLocaleCookieName()
): string | null {
  return nativeStoreGet(key);
}

/**
 * Get a value from the native store
 * @param key - The key to get the value for
 * @returns The value for the key
 */
export function nativeStoreGet(key: string): string | null {
  if (Platform.OS === 'web') {
    if (typeof localStorage === 'undefined') {
      // eslint-disable-next-line no-console
      console.warn(ssrUnsupportedWarning);
      return null;
    }
    return localStorage.getItem(key);
  }
  return GtReactNative?.nativeStoreGet(key) ?? null;
}

/**
 * Set a value in the native store
 * @param key - The key to set the value for
 * @param value - The value to set
 */
export function nativeStoreSet(key: string, value: string): void {
  if (Platform.OS === 'web') {
    if (typeof localStorage === 'undefined') {
      // eslint-disable-next-line no-console
      console.warn(ssrUnsupportedWarning);
      return;
    }
    localStorage.setItem(key, value);
    return;
  }
  GtReactNative?.nativeStoreSet(key, value);
}
