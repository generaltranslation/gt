import type { StoreListener, TranslateLookup, Unsubscribe } from './storeTypes';
import { getTranslateListenerKey } from 'gt-i18n/internal';
import { getReactI18nCache } from '../i18n-cache/singleton-operations';
import type { Translation } from 'gt-i18n/types';

type RuntimeTranslationStore = {
  subscribeToTranslate: <T extends Translation>(
    lookup: TranslateLookup<T>,
    listener: StoreListener
  ) => Unsubscribe;
  translate: (lookup: TranslateLookup) => void;
};

/**
 * Owned by I18nStore, this should not be imported to any other files
 */
export class RuntimeTranslationScope {
  private version = 0;
  private listeners = new Set<() => void>();
  private pendingKeys = new Map<string, Unsubscribe>();

  constructor(private store: RuntimeTranslationStore) {}

  translate(lookup: TranslateLookup) {
    if (!getReactI18nCache().isDevHotReloadEnabled()) return;

    const key = getTranslateListenerKey(lookup);
    if (this.pendingKeys.has(key)) return;
    const unsubscribe = this.store.subscribeToTranslate(lookup, () =>
      this.notifyResolved(lookup)
    );
    this.pendingKeys.set(key, unsubscribe);
    this.store.translate(lookup);
  }

  /**
   * Only notify when all lookups are resolved
   */
  notifyResolved(lookup: TranslateLookup) {
    const key = getTranslateListenerKey(lookup);
    if (!this.pendingKeys.has(key)) return;
    const unsubscribe = this.pendingKeys.get(key);
    unsubscribe?.();
    this.pendingKeys.delete(key);

    if (this.pendingKeys.size === 0) {
      this.version++;
      this.listeners.forEach((listener) => listener());
    }
  }

  getSnapshot = () => this.version;

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };
}
