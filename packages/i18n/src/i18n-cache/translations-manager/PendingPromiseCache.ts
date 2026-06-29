export class PendingPromiseCache<Key extends string, Value> {
  private promises = new Map<Key, Promise<Value>>();

  public getOrCreate(key: Key, create: () => Promise<Value>): Promise<Value> {
    const cachedPromise = this.promises.get(key);
    if (cachedPromise) {
      return cachedPromise;
    }

    const promise = create().finally(() => {
      if (this.promises.get(key) === promise) {
        this.promises.delete(key);
      }
    });
    this.promises.set(key, promise);
    return promise;
  }
}
