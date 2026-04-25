/**
 * I18n event types
 */
export type I18nEvent =
  | { type: 'localeChanged'; locale: string; previousLocale?: string }
  | {
      type: 'translationsLoaded';
      locale: string;
    }
  | {
      type: 'translationResolved';
      locale: string;
    };

/**
 * Listener function type
 */
export type I18nEventListener = (event: I18nEvent) => void;

/**
 * Simple event emitter for I18nManager events.
 * Designed to support useSyncExternalStore in React-core.
 */
export class I18nEventEmitter {
  private _listeners: Set<I18nEventListener> = new Set();
  private _version: number = 0;

  /**
   * Subscribe to events. Returns an unsubscribe function.
   */
  subscribe(listener: I18nEventListener): () => void {
    this._listeners.add(listener);
    return () => {
      this._listeners.delete(listener);
    };
  }

  /**
   * Emit an event to all listeners and bump the version.
   */
  emit(event: I18nEvent): void {
    this._version++;
    this._listeners.forEach((listener) => {
      listener(event);
    });
  }

  /**
   * Get the current version (monotonic counter).
   * Useful as a snapshot value for useSyncExternalStore.
   */
  getVersion(): number {
    return this._version;
  }
}
