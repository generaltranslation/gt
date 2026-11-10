import { libraryDefaultLocale } from '../settings/settings';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Constructor = new (...args: any[]) => object;

/**
 * The constructors of the Intl namespace, without its static functions like
 * `getCanonicalLocales`. Read from the `lib` in use, which may lack some.
 */
type IntlConstructors = {
  [K in keyof typeof Intl as (typeof Intl)[K] extends Constructor
    ? K
    : never]: (typeof Intl)[K];
};

// Bounds what comes from input, such as a currency or a time zone.
const MAX_INSTANCES = 256;

/**
 * Shares instances of constructors that take `(locales, options)`, like
 * Intl's: building one costs far more than using it. A constructor is read
 * when it is used, so one installed later, like a polyfill, is found.
 */
export class IntlCache<Constructors extends Record<string, Constructor>> {
  constructor(
    private readonly constructors: Constructors,
    private readonly instances: Partial<
      Record<PropertyKey, Map<string, object>>
    > = {}
  ) {}

  /** The instance for these arguments: the same one until the cache is full. */
  get<K extends keyof Constructors>(
    constructor: K,
    ...args: ConstructorParameters<Constructors[K]>
  ): InstanceType<Constructors[K]> {
    const locales: Intl.LocalesArgument = args[0] ?? libraryDefaultLocale;
    // One copy is both the key and the argument, so they cannot differ: Intl
    // would also read options the copy leaves out, such as inherited ones.
    const options: { timeZone?: unknown } = { ...args[1] };
    let key = `${String(locales)}|${JSON.stringify(options)}`;
    // Without a time zone a formatter takes the host's, which can change
    // while the process runs. A change of the host's offset gives a new one.
    if (constructor === 'DateTimeFormat' && !options.timeZone) {
      key += `|${new Date().getTimezoneOffset()}`;
    }
    const instances = (this.instances[constructor] ??= new Map());
    let instance = instances.get(key);
    if (!instance) {
      instance = new this.constructors[constructor](locales, options);
      if (instances.size >= MAX_INSTANCES) instances.clear();
      instances.set(key, instance);
    }
    // The only instances under a constructor's name are its own.
    return instance as InstanceType<Constructors[K]>;
  }

  /**
   * A cache of these constructors too, for a package's own formats. It shares
   * this cache's instances, so each one is still built once.
   */
  extend<More extends Record<string, Constructor>>(
    more: More
  ): IntlCache<Constructors & More> {
    return new IntlCache(
      // Inherits, so a constructor of this cache is still read when used.
      Object.assign(Object.create(this.constructors), more),
      this.instances
    );
  }
}

/** The instances of Intl's own constructors, shared by every package. */
export const intlCache = new IntlCache<IntlConstructors>(Intl);
