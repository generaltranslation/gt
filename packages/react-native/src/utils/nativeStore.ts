import { Platform } from 'react-native';
import GtReactNative from '../NativeGtReactNative';

/**
 * Native store interface, used to replace cookie behavior from gt-react
 */

/**
 * Get a value from the native store
 * @param key - The key to get the value for
 * @returns The value for the key
 */
export function nativeStoreGet(key: string): string | null {
  if (Platform.OS === 'web') {
    return localStorage.getItem(key);
  }
  return GtReactNative.nativeStoreGet(key);
}

/**
 * Set a value in the native store
 * @param key - The key to set the value for
 * @param value - The value to set
 */
export function nativeStoreSet(key: string, value: string): void {
  if (Platform.OS === 'web') {
    localStorage.setItem(key, value);
    return;
  }
  GtReactNative.nativeStoreSet(key, value);
}
