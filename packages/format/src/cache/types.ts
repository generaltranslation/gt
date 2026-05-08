import { CutoffFormatConstructor } from '../formatting/custom-formats/CutoffFormat/CutoffFormat';

/**
 * Extracts only the constructor functions from the Intl namespace,
 * filtering out static methods like getCanonicalLocales and supportedValuesOf
 */
type IntlConstructors = {
  [K in keyof typeof Intl as (typeof Intl)[K] extends new (
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ...args: any[]
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ) => any
    ? K
    : never]: (typeof Intl)[K];
};

/**
 * Extended interface that includes all native Intl constructors plus custom ones
 */
export interface CustomIntlConstructors extends IntlConstructors {
  CutoffFormat: typeof CutoffFormatConstructor;
}

/**
 * Helper type to represent a constructor function for a given Intl constructor key
 */
export type ConstructorType<K extends keyof CustomIntlConstructors> = new (
  ...args: ConstructorParameters<CustomIntlConstructors[K]>
) => InstanceType<CustomIntlConstructors[K]>;

/**
 * Type for the cache object structure - each constructor gets its own Record
 * mapping cache keys to instances of that specific constructor type
 */
export type IntlCacheObject = {
  [K in keyof CustomIntlConstructors]?: Record<
    string,
    InstanceType<ConstructorType<K>>
  >;
};

/**
 * Type for the CustomIntl object that maps constructor names to constructor functions
 */
export type CustomIntlType = {
  [K in keyof CustomIntlConstructors]: ConstructorType<K>;
};
