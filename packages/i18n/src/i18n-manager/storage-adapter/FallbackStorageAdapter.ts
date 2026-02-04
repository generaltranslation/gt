import StorageAdapter from './StorageAdapter';

/**
 * Fallback to storage adapter that is scoped to the entire process
 */
class FallbackStorageAdapter extends StorageAdapter {
  private storage: Record<string, string> = {};

  getItem(key: string): string | undefined {
    return this.storage[key];
  }

  setItem(key: string, value: string): void {
    this.storage[key] = value;
  }

  removeItem(key: string): void {
    delete this.storage[key];
  }
}

export { FallbackStorageAdapter };
