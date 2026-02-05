import { StorageAdapterType } from './types';

/**
 * Abstract class to be overridden by the wrapper library.
 */
abstract class StorageAdapter {
  abstract readonly type: StorageAdapterType;

  /**
   * Get an item from the storage
   * @param key - The key to get the item for
   * @returns The item or undefined if not found
   */
  abstract getItem(key: string): string | undefined;

  /**
   * Set an item in the storage
   * @param key - The key to set the item for
   * @param value - The value to set the item to
   */
  abstract setItem(key: string, value: string): void;

  /**
   * Remove an item from the storage
   * @param key - The key to remove the item for
   */
  abstract removeItem(key: string): void;
}

export { StorageAdapter };
