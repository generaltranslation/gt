import { getI18nStore } from "./singleton-operations";
import type { DictionaryLookup, Unsubscribe } from "./storeTypes";
import { getDictionaryListenerKey } from "gt-i18n/internal";

/**
 * Tracks dictionary lookups discovered by useTranslations callbacks.
 */
export class RuntimeDictionaryScope {
  private version = 0;
  private listeners = new Set<() => void>();
  private pendingEntries = new Map<string, Unsubscribe>();
  private pendingObjects = new Map<string, Unsubscribe>();

  translateEntry(lookup: DictionaryLookup) {
    // TODO: enforce dev mode only
    const key = getDictionaryListenerKey(lookup);
    if (this.pendingEntries.has(key)) return;

    const store = getI18nStore();
    const unsubscribe = store.subscribeToDictionaryEntry(lookup, () =>
      this.notifyResolved(key, this.pendingEntries),
    );
    this.pendingEntries.set(key, unsubscribe);
    store.translateDictionaryEntry(lookup);
  }

  translateObject(lookup: DictionaryLookup) {
    // TODO: enforce dev mode only
    const key = getDictionaryListenerKey(lookup);
    if (this.pendingObjects.has(key)) return;

    const store = getI18nStore();
    const unsubscribe = store.subscribeToDictionaryObject(lookup, () =>
      this.notifyResolved(key, this.pendingObjects),
    );
    this.pendingObjects.set(key, unsubscribe);
    store.translateDictionaryObject(lookup);
  }

  getSnapshot = () => this.version;

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  private notifyResolved(key: string, pending: Map<string, Unsubscribe>): void {
    const unsubscribe = pending.get(key);
    if (!unsubscribe) return;

    unsubscribe();
    pending.delete(key);

    if (this.pendingEntries.size === 0 && this.pendingObjects.size === 0) {
      this.version++;
      this.listeners.forEach((listener) => listener());
    }
  }
}
