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

/**
 * A date formatter is shared by its arguments, so they hold its time zone:
 * without one it would take the host's, which its arguments do not tell.
 */
type SharedIntlConstructors = Omit<IntlConstructors, 'DateTimeFormat'> & {
  DateTimeFormat: new (
    locales: Intl.LocalesArgument,
    options: Intl.DateTimeFormatOptions & { timeZone: string }
  ) => Intl.DateTimeFormat;
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
    // By constructor, not by its name: two copies of a package that each
    // extend this cache with their own format do not get each other's.
    private readonly instances = new WeakMap<Constructor, Map<string, object>>()
  ) {}

  /** The instance for these arguments: the same one until the cache is full. */
  get<K extends keyof Constructors>(
    constructor: K,
    ...args: ConstructorParameters<Constructors[K]>
  ): InstanceType<Constructors[K]> {
    const locales: Intl.LocalesArgument = args[0] ?? libraryDefaultLocale;
    // One copy is both the key and the argument, so they cannot differ: Intl
    // would also read options the copy leaves out, such as inherited ones.
    // Its keys are sorted, so options in another order share an instance.
    const options: Record<string, unknown> = {};
    for (const name of Object.keys(args[1] ?? {}).sort()) {
      options[name] = args[1][name];
    }
    const key = `${String(locales)}|${JSON.stringify(options)}`;
    const Constructor = this.constructors[constructor];
    let instances = this.instances.get(Constructor);
    if (!instances) this.instances.set(Constructor, (instances = new Map()));
    let instance = instances.get(key);
    if (!instance) {
      instance = new Constructor(locales, options);
      if (instances.size >= MAX_INSTANCES) instances.clear();
      instances.set(key, instance);
    }
    // The only instances kept for a constructor are the ones it built.
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
export const intlCache = new IntlCache<SharedIntlConstructors>(Intl);
