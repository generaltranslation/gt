/**
 * Cache class
 * This is designed in such a way that it is the responsibility of the client
 * to invoke the cache miss method when a cache miss occurs.
 */
abstract class Cache<InputKey, CacheKey extends string, CacheValue> {
  /**
   * Cache of items
   */
  private cache: Record<CacheKey, CacheValue> = {} as Record<
    CacheKey,
    CacheValue
  >;

  /**
   * Constructor
   * @param {Object} params - The parameters for the cache
   * @param {Record<CacheKey, CacheValue>} params.init - The initial cache
   */
  constructor(init: Record<CacheKey, CacheValue>) {
    // eslint-disable-next-line no-undef
    this.cache = structuredClone(init);
  }

  /**
   * Set the value for a key
   */
  protected setWithCacheKey(cacheKey: CacheKey, value: CacheValue): void {
    this.cache[cacheKey] = value;
  }

  /**
   * Look up the key
   */
  public get(key: InputKey): CacheValue | undefined {
    const cacheKey = this.genKey(key);
    return this.cache[cacheKey];
  }

  /**
   * Fallback to the value from the fallback function on a cache miss
   */
  public async miss(key: InputKey): Promise<CacheValue> {
    const value = await this.fallback(key);
    const cacheKey = this.genKey(key);
    this.cache[cacheKey] = value;
    return this.fallback(key);
  }

  /**
   * Customizable helper function that calculates the cache key from an input key
   */
  abstract genKey(key: InputKey): CacheKey;

  /**
   * Get the fallback value for a cache miss
   */
  abstract fallback(key: InputKey): Promise<CacheValue>;
}

export { Cache };
