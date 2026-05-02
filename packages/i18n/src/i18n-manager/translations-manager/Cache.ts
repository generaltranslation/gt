import type {
  LifecycleCallback,
  LifecycleParam,
} from '../lifecycle-hooks/types';

/**
 * Cache class
 * This is designed in such a way that it is the responsibility of the client
 * to invoke the cache miss method when a cache miss occurs.
 *
 * TODO: maybe add "OutputValue" as a reflection of "InputKey"
 */
abstract class Cache<
  InputKey,
  CacheKey extends string,
  CacheValue,
  OutputValue extends unknown,
> {
  /**
   * Cache of items
   */
  private cache: Record<CacheKey, CacheValue> = {} as Record<
    CacheKey,
    CacheValue
  >;

  /**
   * Promise cache for inflight fallbacks
   */
  private fallbackPromises: Partial<Record<CacheKey, Promise<CacheValue>>> =
    {} as Record<CacheKey, Promise<CacheValue>>;

  /**
   * Lifecycle callbacks - invoked in implementation of the abstract methods
   * - onHit: invoked when a cache hit occurs
   * - onMiss: invoked when a cache miss occurs
   */
  protected onHit?: LifecycleCallback<
    InputKey,
    CacheKey,
    CacheValue,
    OutputValue
  >;
  protected onMiss?: LifecycleCallback<
    InputKey,
    CacheKey,
    CacheValue,
    OutputValue
  >;

  /**
   * Constructor
   * @param {Object} params - The parameters for the cache
   * @param {Record<CacheKey, CacheValue>} params.init - The initial cache
   * @param {CacheLifecycle} [lifecycle] - Optional lifecycle callbacks
   */
  constructor(
    init: Record<CacheKey, CacheValue>,
    lifecycle?: LifecycleParam<InputKey, CacheKey, CacheValue, OutputValue>
  ) {
    this.cache = structuredClone(init);
    this.onHit = lifecycle?.onHit;
    this.onMiss = lifecycle?.onMiss;
  }

  /**
   * Set the value for a key
   */
  protected setCache(cacheKey: CacheKey, value: CacheValue): void {
    this.cache[cacheKey] = value;
  }

  /**
   * Look up the key
   */
  protected getCache(key: InputKey): CacheValue | undefined {
    const cacheKey = this.genKey(key);
    return this.cache[cacheKey];
  }

  /**
   * Get the internal cache
   * @returns The internal cache
   *
   * @internal - used by gt-tanstack-start
   */
  public getInternalCache(): Record<CacheKey, CacheValue> {
    return this.cache;
  }

  /**
   * Fallback to the value from the fallback function on a cache miss
   * @important assumes that the fallback error handling done upstream
   */
  protected async missCache(key: InputKey): Promise<CacheValue> {
    // Check for inflight fallback
    const cacheKey = this.genKey(key);
    if (this.fallbackPromises[cacheKey] !== undefined) {
      return await this.fallbackPromises[cacheKey];
    }

    // Add to inflight fallback cache
    const fallbackPromise = this.fallback(key);
    this.fallbackPromises[cacheKey] = fallbackPromise;

    // Wait for fallback to complete
    try {
      // Wait for fallback to complete
      const value = await fallbackPromise;

      // Update cache
      this.cache[cacheKey] = value;
      return value;
    } finally {
      delete this.fallbackPromises[cacheKey];
    }
  }

  // ===== Abstract Methods ===== //

  /**
   * Customizable helper function that calculates the cache key from an input key
   */
  protected abstract genKey(key: InputKey): CacheKey;

  /**
   * Get the fallback value for a cache miss
   */
  protected abstract fallback(key: InputKey): Promise<CacheValue>;

  /**
   * Lookup a value in the cache
   */
  public abstract get(key: InputKey): OutputValue | undefined;

  /**
   * Miss the cache
   */
  public abstract miss(key: InputKey): Promise<OutputValue | undefined>;
}

export { Cache };
