/**
 * Extracts only the constructor functions from the Intl namespace,
 * filtering out static methods like getCanonicalLocales and supportedValuesOf
 */
export type IntlConstructors = {
  [K in keyof typeof Intl as (typeof Intl)[K] extends new (
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ...args: any[]
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ) => any
    ? K
    : never]: (typeof Intl)[K];
};

/**
 * Helper type to represent a constructor function for a given Intl constructor key
 */
export type ConstructorType<K extends keyof IntlConstructors> = new (
  ...args: ConstructorParameters<IntlConstructors[K]>
) => InstanceType<IntlConstructors[K]>;

/**
 * Type for the cache object structure - each constructor gets its own Record
 * mapping cache keys to instances of that specific constructor type
 */
export type IntlCacheObject = {
  [K in keyof IntlConstructors]?: Record<
    string,
    InstanceType<ConstructorType<K>>
  >;
};

/**
 * Type for the CustomIntl object that maps constructor names to constructor functions
 */
export type IntlConstructorMap = {
  [K in keyof IntlConstructors]: ConstructorType<K>;
};
