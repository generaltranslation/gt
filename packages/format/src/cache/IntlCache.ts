import { libraryDefaultLocale } from '../settings/settings';
import { CutoffFormatConstructor } from '../formatting/custom-formats/CutoffFormat/CutoffFormat';
import {
  ConstructorType,
  CustomIntlConstructors,
  CustomIntlType,
  IntlCacheObject,
} from './types';

/**
 * Object mapping constructor names to their respective constructor functions
 * Includes all native Intl constructors plus custom ones like CutoffFormat
 */
const CustomIntl: CustomIntlType = {
  Collator: Intl.Collator,
  DateTimeFormat: Intl.DateTimeFormat,
  DisplayNames: Intl.DisplayNames,
  ListFormat: Intl.ListFormat,
  Locale: Intl.Locale,
  NumberFormat: Intl.NumberFormat,
  PluralRules: Intl.PluralRules,
  RelativeTimeFormat: Intl.RelativeTimeFormat,
  Segmenter: Intl.Segmenter,
  CutoffFormat: CutoffFormatConstructor,
};

/**
 * Cache for Intl and custom format instances to avoid repeated instantiation
 * Uses a two-level structure: constructor name -> cache key -> instance.
 */
class IntlCache {
  private cache: IntlCacheObject = {};

  /**
   * Generates a consistent cache key from locales and options.
   * Handles all LocalesArgument types (string, Locale, array, undefined).
   */
  private generateKey(locales: Intl.LocalesArgument, options = {}) {
    // Normalize locales to string representation
    const localeKey = !locales
      ? 'undefined'
      : Array.isArray(locales)
        ? locales.map((l) => String(l)).join(',')
        : String(locales);

    // Sort option keys to ensure consistent key generation regardless of property order
    const sortedOptions = options
      ? JSON.stringify(options, Object.keys(options).sort())
      : '{}';
    return `${localeKey}:${sortedOptions}`;
  }

  /**
   * Gets a cached Intl instance or creates a new one if not found
   * @param constructor The name of the Intl constructor to use.
   * @param args Constructor arguments (locales, options).
   * @returns Cached or newly created Intl instance.
   */
  get<K extends keyof CustomIntlConstructors>(
    constructor: K,
    ...args: ConstructorParameters<CustomIntlConstructors[K]>
  ): InstanceType<ConstructorType<K>> {
    const [locales = libraryDefaultLocale, options = {}] = args;
    const key = this.generateKey(locales, options);
    let cache = this.cache[constructor];
    if (cache === undefined) {
      cache = {};
      this.cache[constructor] = cache;
    }
    let intlObject = cache[key];

    if (intlObject === undefined) {
      // Create new instance and cache it
      intlObject = new CustomIntl[constructor](...args);
      cache[key] = intlObject;
    }

    return intlObject;
  }
}

/**
 * Global instance of the Intl cache for use throughout the application
 */
export const intlCache = new IntlCache();
