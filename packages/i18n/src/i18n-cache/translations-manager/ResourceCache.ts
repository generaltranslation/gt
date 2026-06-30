import { DEFAULT_CACHE_EXPIRY_TIME } from './utils/constants';

export type ResourceCacheEntry<Value> = {
  expiresAt: number;
  value: Value;
};

export class ResourceCache<Key extends string, Value> {
  private cache = new Map<Key, ResourceCacheEntry<Value>>();
  private pendingLoads = new Map<Key, Promise<ResourceCacheEntry<Value>>>();
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

  private async load(key: Key): Promise<Value> {
    let loadPromise = this.pendingLoads.get(key);
    if (!loadPromise) {
      loadPromise = this.loadResource(key).then((value) => {
        const entry = {
          expiresAt: this.getExpiresAt(),
          value,
        };
        this.cache.set(key, entry);
        return entry;
      });
      this.pendingLoads.set(key, loadPromise);
    }

    try {
      const entry = await loadPromise;
      return entry.value;
    } finally {
      this.pendingLoads.delete(key);
    }
  }

  private getExpiresAt(): number {
    return this.ttl < 0 ? this.ttl : Date.now() + this.ttl;
  }

  private isExpired(entry: ResourceCacheEntry<Value>): boolean {
    return entry.expiresAt > 0 && entry.expiresAt < Date.now();
  }
}
