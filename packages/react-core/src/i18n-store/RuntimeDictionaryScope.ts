import type {
  DictionaryLookup,
  StoreListener,
  Unsubscribe,
} from './storeTypes';
import { getDictionaryListenerKey } from 'gt-i18n/internal';
import { getReactI18nCache } from '../i18n-cache/singleton-operations';

type RuntimeDictionaryStore = {
  subscribeToDictionaryEntry: (
    lookup: DictionaryLookup,
    listener: StoreListener
  ) => Unsubscribe;
  subscribeToDictionaryObject: (
    lookup: DictionaryLookup,
    listener: StoreListener
  ) => Unsubscribe;
  translateDictionaryEntry: (lookup: DictionaryLookup) => void;
  translateDictionaryObject: (lookup: DictionaryLookup) => void;
};

/**
 * Tracks dictionary lookups discovered by useTranslations callbacks.
 */
export class RuntimeDictionaryScope {
  private version = 0;
  private listeners = new Set<() => void>();
  private pendingEntries = new Map<string, Unsubscribe>();
  private pendingObjects = new Map<string, Unsubscribe>();

  constructor(private store: RuntimeDictionaryStore) {}

  translateEntry(lookup: DictionaryLookup) {
    if (!getReactI18nCache().isDevHotReloadEnabled()) return;

    const key = getDictionaryListenerKey(lookup);
    if (this.pendingEntries.has(key)) return;

    const unsubscribe = this.store.subscribeToDictionaryEntry(lookup, () =>
      this.notifyResolved(key, this.pendingEntries)
    );
    this.pendingEntries.set(key, unsubscribe);
    this.store.translateDictionaryEntry(lookup);
  }

  translateObject(lookup: DictionaryLookup) {
    if (!getReactI18nCache().isDevHotReloadEnabled()) return;

    const key = getDictionaryListenerKey(lookup);
    if (this.pendingObjects.has(key)) return;

    const unsubscribe = this.store.subscribeToDictionaryObject(lookup, () =>
      this.notifyResolved(key, this.pendingObjects)
    );
    this.pendingObjects.set(key, unsubscribe);
    this.store.translateDictionaryObject(lookup);
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
