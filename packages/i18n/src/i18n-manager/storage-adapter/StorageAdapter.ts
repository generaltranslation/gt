/**
 * Abstract class to be overridden by the wrapper library.
 */
abstract class StorageAdapter {
  abstract getItem(key: string): string | undefined;
  abstract setItem(key: string, value: string): void;
  abstract removeItem(key: string): void;
}

export default StorageAdapter;
