import { hashSource } from 'generaltranslation/id';
import { _Message, _Messages } from '../internal';

/**
 * Message options for registry entries.
 */
export type MessageOptions = {
  $id?: string;
  $context?: string;
  $_hash?: string; // kept for compatibility
  [key: string]: any;
};

/**
 * Message entry for the registry.
 */
export type MessageEntry = {
  message: string;
  options?: MessageOptions;
};

type Listener = () => void;

/** ----- SINGLETON STORE ----- */

/**
 * Singleton registry for messages, supporting subscription and snapshotting.
 */
class MessageRegistry {
  private map = new Map<string, MessageEntry>();
  private listeners = new Set<Listener>();
  private version = 0;

  // Cached snapshot (stable between version bumps)
  private cachedVersion = -1;
  private cachedSnapshot:
    | {
        registryMessages: _Messages;
        hashMap: Map<string, MessageEntry>;
      }
    | undefined;

  /**
   * Subscribe to registry changes.
   * @param fn Listener function to call on change.
   * @returns Unsubscribe function.
   */
  subscribe = (fn: Listener) => {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  };

  /**
   * Notify all listeners of a change.
   */
  private notify() {
    this.version++;
    for (const fn of this.listeners) fn();
  }

  /**
   * Set a message in the registry, only notifying if changed.
   * @param hash Message hash.
   * @param message Message string.
   * @param options Message options.
   */
  set(hash: string, message: string, options?: MessageOptions) {
    const prev = this.map.get(hash);
    if (
      !prev ||
      prev.message !== message ||
      JSON.stringify(prev.options ?? {}) !== JSON.stringify(options ?? {})
    ) {
      this.map.set(hash, { message, options });
      this.notify();
    }
  }

  /**
   * Get a message entry by hash.
   * @param hash Message hash.
   */
  get(hash: string) {
    return this.map.get(hash);
  }

  /**
   * Check if a message exists by hash.
   * @param hash Message hash.
   */
  has(hash: string) {
    return this.map.has(hash);
  }

  /**
   * Clear all messages from the registry.
   */
  clear() {
    if (this.map.size) {
      this.map.clear();
      this.notify();
    }
  }

  /**
   * Return a CACHED snapshot that only changes when the internal version changes.
   * This ensures useSyncExternalStore's getSnapshot returns a stable reference
   * across renders when nothing has changed, preventing infinite re-render loops.
   *
   * @returns An object containing registryMessages and a hashMap of hashes to message data.
   */
  getSnapshot():
    | {
        registryMessages: _Messages;
        hashMap: Map<string, MessageEntry>;
      }
    | undefined {
    if (this.cachedVersion === this.version) {
      return this.cachedSnapshot;
    }

    // Recompute snapshot for the new version
    const registryMessages: _Message[] = Array.from(this.map.values()).map(
      (entry) => ({
        message: entry.message,
        ...(entry.options ? entry.options : {}),
      })
    );
    // Return a new Map to avoid mutation issues
    const hashMap = new Map(this.map);

    this.cachedSnapshot = { registryMessages, hashMap };
    this.cachedVersion = this.version;
    return this.cachedSnapshot;
  }
}

// ----- SAFE SINGLETON PATTERN FOR HMR ----- //

const REGISTRY_KEY = Symbol.for('gt.messageRegistry');
const globalAny = globalThis as any;
export const messageRegistry: MessageRegistry =
  globalAny[REGISTRY_KEY] ?? (globalAny[REGISTRY_KEY] = new MessageRegistry());

/**
 * Registers an ICU message for translation and returns the original message.
 * This function can be called outside of a context provider and is safe to use globally.
 * It ensures the message is registered in the message registry for extraction and translation workflows.
 *
 * @param {string} message - The ICU message string to register.
 * @param {Object} [options] - Optional variables and metadata for the message.
 * @returns {string} The original message string.
 *
 * @example
 * msg('Hello, {name}!');
 *
 * @remarks
 * This function is intended for registering messages for translation extraction and can be used
 * outside of a <GTProvider> context. It does not perform translation, only registration.
 */
export function msg(message: string) {
  const hash = hashSource({
    source: message,
    dataFormat: 'ICU',
  });
  if (!messageRegistry.has(hash)) {
    queueMicrotask(() => {
      if (!messageRegistry.has(hash)) {
        messageRegistry.set(hash, message, { $_hash: hash });
      }
    });
  }
  return message;
}
