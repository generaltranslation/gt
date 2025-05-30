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

  get<K extends keyof typeof Intl>(
    constructor: K,
    locales: string | string[],
    options = {}
  ): /* @ts-expect-error constructors must be valid */
  InstanceType<(typeof Intl)[K]> {
    const key = this._generateKey(constructor, locales, options);
    if (!this.cache.has(key)) {
      // Create a new Intl object if not in cache
      const intlObject = new (Intl[constructor] as any)(locales, options);
      this.cache.set(key, intlObject);
    }
    return this.cache.get(key);
  }
}

export const intlCache = new IntlCache();
