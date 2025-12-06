import { CutoffFormatConstructor } from '../formatting/custom-formats/CutoffFormat/CutoffFormat';
import { CustomIntlConstructors } from './types';

const CustomIntl = {
  ...Intl,
  CutoffFormat: CutoffFormatConstructor,
} as const;

class IntlCache {
  private cache: Map<string, any>;

  constructor() {
    // Create separate caches for each Intl constructor
    this.cache = new Map();
  }

  private _generateKey(
    constructor: string,
    locales: string | string[],
    options = {}
  ) {
    // Handle both string and array locales
    const localeKey = Array.isArray(locales) ? locales.join(',') : locales;
    // Sort option keys to ensure consistent key generation
    const sortedOptions = options
      ? JSON.stringify(options, Object.keys(options).sort())
      : '{}';
    return `${constructor}:${localeKey}:${sortedOptions}`;
  }

  get<K extends keyof CustomIntlConstructors>(
    constructor: K,
    locales: string | string[],
    options: ConstructorParameters<CustomIntlConstructors[K]>[1] = {}
  ): InstanceType<CustomIntlConstructors[K]> {
    const key = this._generateKey(constructor, locales, options);
    if (!this.cache.has(key)) {
      // Create a new Intl object if not in cache
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const intlObject = new (CustomIntl[constructor] as any)(locales, options);
      this.cache.set(key, intlObject);
    }
    return this.cache.get(key);
  }
}

export const intlCache = new IntlCache();
