import { Platform } from 'react-native';
import GtReactNative from '../NativeGtReactNative';

/**
 * Get native device locales in preference order
 * Returns an empty array if detection fails or is not supported
 *
 * iOS: Returns current locale first, followed by preferred languages
 * Android: Returns user's preferred language list (LocaleList on API 24+, single locale on older versions)
 * Web: Returns browser language preferences from navigator
 */
export function getNativeLocales(): string[] {
  try {
    // Web platform - use browser locale detection
    if (Platform.OS === 'web') {
      return getWebLocales();
    }

    // Try to get locales from native module
    return GtReactNative.getNativeLocales() || [];
  } catch (error) {
    // Return empty array on any error (native module not available, etc.)
    return [];
  }
}

/**
 * Get browser locales for web platform
 */
function getWebLocales(): string[] {
  try {
    if (typeof navigator === 'undefined') {
      return [];
    }

    const locales: string[] = [];

    // Use navigator.languages if available (most browsers)
    if (navigator.languages && Array.isArray(navigator.languages)) {
      locales.push(...navigator.languages);
    } else if (navigator.language) {
      // Fallback to single language
      locales.push(navigator.language);
    } else if ((navigator as any).userLanguage) {
      // IE fallback
      locales.push((navigator as any).userLanguage);
    }

    return locales;
  } catch (error) {
    return [];
  }
}
