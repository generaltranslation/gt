import { DEFAULT_CACHE_EXPIRY_TIME } from './utils/constants';
import { dedupePending } from './utils/dedupePending';

export type ResourceCacheEntry<Value> = {
  expiresAt: number;
  value: Value;
};

export class ResourceCache<Key extends string, Value> {
  private cache = new Map<Key, ResourceCacheEntry<Value>>();
  private pendingLoads = new Map<Key, Promise<Value>>();
  private loadResource: (key: Key) => Promise<Value>;
  private ttl: number;

  constructor({
    load,
    ttl,
  }: {
    load: (key: Key) => Promise<Value>;
    ttl?: number | null;
  }) {
    this.loadResource = load;
    this.ttl = ttl === null ? -1 : (ttl ?? DEFAULT_CACHE_EXPIRY_TIME);
  }

  public get(key: Key): Value | undefined {
    const entry = this.cache.get(key);
    if (!entry || this.isExpired(entry)) {
      return undefined;
    }

    return entry.value;
  }

  public set(
    key: Key,
    value: Value,
    { expiresAt = this.getExpiresAt() }: { expiresAt?: number } = {}
  ): void {
    this.cache.set(key, {
      expiresAt,
      value,
    });
  }

  public async getOrLoad(key: Key): Promise<Value> {
    return this.get(key) ?? (await this.load(key));
  }

  private load(key: Key): Promise<Value> {
    return dedupePending(this.pendingLoads, key, () =>
      // The entry expiry is computed when the load resolves, not when it starts
      this.loadResource(key).then((value) => {
        this.set(key, value);
        return value;
      })
    );
  }

  private getExpiresAt(): number {
    // Avoid Date.now() for Next.js Cache Components; Next handles caching.
    return this.ttl <= 0 ? this.ttl : Date.now() + this.ttl;
  }

  private isExpired(entry: ResourceCacheEntry<Value>): boolean {
    // Avoid Date.now() for Next.js Cache Components; Next handles caching.
    if (entry.expiresAt === 0) return true;
    return entry.expiresAt > 0 && entry.expiresAt < Date.now();
  }
}
