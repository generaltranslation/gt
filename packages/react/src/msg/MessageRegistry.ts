import { hashSource } from 'generaltranslation/id';
import { _Message, _Messages } from '../internal';

/**
 * Message entry for the registry.
 */
export type MessageEntry = {
  message: string;
};

type Listener = () => void;

/** ----- SINGLETON STORE ----- */

/**
 * Singleton registry for messages, supporting subscription and snapshotting.
 *
 * This version uses a Set<string> to store unique message strings.
 */
class MessageRegistry {
  private messageSet = new Set<string>();
  private listeners = new Set<Listener>();
  private version = 0;

  // Cached snapshot (stable between version bumps)
  private cachedVersion = -1;
  private cachedSnapshot: Set<string> | undefined;

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
   * Add a message to the registry, only notifying if changed.
   * @param message Message string.
   */
  set(message: string) {
    if (!this.messageSet.has(message)) {
      this.messageSet.add(message);
      this.notify();
    }
  }

  /**
   * Check if a message exists in the registry.
   * @param message Message string.
   */
  has(message: string) {
    return this.messageSet.has(message);
  }

  /**
   * Remove all messages from the registry.
   */
  clear() {
    if (this.messageSet.size) {
      this.messageSet.clear();
      this.notify();
    }
  }

  /**
   * Return a CACHED snapshot that only changes when the internal version changes.
   * This ensures useSyncExternalStore's getSnapshot returns a stable reference
   * across renders when nothing has changed, preventing infinite re-render loops.
   *
   * @returns An object containing registryMessages and the messageSet.
   */
  getSnapshot(): Set<string> | undefined {
    if (this.cachedVersion === this.version) {
      return this.cachedSnapshot;
    }
    // Return a new Set to avoid mutation issues
    const messageSet = new Set(this.messageSet);
    this.cachedSnapshot = messageSet;
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
<<<<<<< HEAD
export function msg(message: string) {
  if (!messageRegistry.has(message)) {
=======
export function msg(message: string, _options?: { $_hash?: string }) {
  const { $_hash } = _options ?? {};
  const hash =
    $_hash ??
    hashSource({
      source: message,
      dataFormat: 'ICU',
    });
  if (!messageRegistry.has(hash)) {
>>>>>>> 60d060dad7c8fc7730187e5f6881dd3e995114e6
    queueMicrotask(() => {
      if (!messageRegistry.has(message)) {
        messageRegistry.set(message);
      }
    });
  }
  return message;
}
