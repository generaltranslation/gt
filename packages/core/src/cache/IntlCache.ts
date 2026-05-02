import { libraryDefaultLocale } from '../settings/settings';
import { CutoffFormatConstructor } from '../formatting/custom-formats/CutoffFormat/CutoffFormat';
import {
  ConstructorType,
  CustomIntlConstructors,
  CustomIntlType,
  IntlCacheObject,
} from './types';

/**
 * Maps constructor names to constructor functions.
 * Includes native Intl constructors and custom constructors such as CutoffFormat.
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
 * Caches Intl and custom format instances to avoid repeated instantiation.
 * Uses a two-level structure: constructor name -> cache key -> instance.
 */
class IntlCache {
  private cache: IntlCacheObject;

  constructor() {
    this.cache = {};
  }

  /**
   * Generates a consistent cache key from locales and options.
   * Handles all LocalesArgument types (string, Locale, array, undefined).
   */
  private _generateKey(locales: Intl.LocalesArgument, options = {}) {
    // Normalize locales to a string representation.
    const localeKey = !locales
      ? 'undefined'
      : Array.isArray(locales)
        ? locales.map((l) => String(l)).join(',')
        : String(locales);

    // Sort option keys so property order does not affect cache keys.
    const sortedOptions = options
      ? JSON.stringify(options, Object.keys(options).sort())
      : '{}';
    return `${localeKey}:${sortedOptions}`;
  }

  /**
   * Gets a cached Intl instance, or creates one when missing.
   * @param constructor The name of the Intl constructor to use.
   * @param args Constructor arguments (locales, options).
   * @returns Cached or newly created Intl instance.
   */
  get<K extends keyof CustomIntlConstructors>(
    constructor: K,
    ...args: ConstructorParameters<CustomIntlConstructors[K]>
  ): InstanceType<ConstructorType<K>> {
    const [locales = libraryDefaultLocale, options = {}] = args;
    const key = this._generateKey(locales, options);
    let intlObject = this.cache[constructor]?.[key];

    if (intlObject === undefined) {
      // Create and cache a new instance.
      intlObject = new CustomIntl[constructor](...args);
      if (!this.cache[constructor]) this.cache[constructor] = {};
      this.cache[constructor][key] = intlObject;
    }

    return intlObject;
  }
}

/**
 * Shared Intl cache instance used throughout the package.
 */
export const intlCache = new IntlCache();
