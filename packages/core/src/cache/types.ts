import { CutoffFormatConstructor } from '../formatting/custom-formats/CutoffFormat/CutoffFormat';

/**
 * Extracts constructor functions from the Intl namespace,
 * filtering out static methods such as getCanonicalLocales and supportedValuesOf.
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
 * Extends native Intl constructors with custom constructors.
 */
export interface CustomIntlConstructors extends IntlConstructors {
  CutoffFormat: typeof CutoffFormatConstructor;
}

/**
 * Represents a constructor function for a given Intl constructor key.
 */
export type ConstructorType<K extends keyof CustomIntlConstructors> = new (
  ...args: ConstructorParameters<CustomIntlConstructors[K]>
) => InstanceType<CustomIntlConstructors[K]>;

/**
 * Cache object structure.
 * Each constructor gets its own record mapping cache keys to instances.
 */
export type IntlCacheObject = {
  [K in keyof CustomIntlConstructors]?: Record<
    string,
    InstanceType<ConstructorType<K>>
  >;
};

/**
 * Maps constructor names to constructor functions.
 */
export type CustomIntlType = {
  [K in keyof CustomIntlConstructors]: ConstructorType<K>;
};
