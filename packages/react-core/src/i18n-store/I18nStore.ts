import { getTranslateListenerKey, Hash, Locale } from 'gt-i18n/internal';
import type {
  StoreListener,
  TranslateEventListener,
  TranslateLookup,
  TranslateSnapshot,
  Unsubscribe,
} from './storeTypes';
import type { Translation } from 'gt-i18n';
import { subscribeToSet } from './utils/subscriptions';
import { getReactI18nCache } from '../i18n-cache/singleton-operations';
import { lookupTranslation } from './utils/translations';
import { createRuntimeTranslationErrorLogger } from './utils/runtimeTranslationErrors';

/**
 * I18nStore gives us the ability to perform client-side updates to translations.
 * Primarily useful for dev hot reload.
 *
 * This is the stateful primitive behind lookup subscriptions and runtime
 * translation requests. It intentionally does not know whether lookups are
 * being served from SPA singletons or SRA provider snapshots; that policy lives
 * in LookupAdapter, not in this store.
 */
export class I18nStore {
  // ----- Listener Sets ----- //

  private translateListeners = new Set<TranslateEventListener>();
  private logRuntimeTranslationError = createRuntimeTranslationErrorLogger();

  /**
   * I18nCache must be already initialized
   */
  constructor() {}

  // ========== Translation Updates ========== //

  updateTranslations = (
    translations: Record<Locale, Record<Hash, Translation>>
  ): void => {
    getReactI18nCache().updateTranslations(translations);
  };

  // ========== runtime translation ========== //

  translate = async <T extends Translation>(
    lookup: TranslateLookup<T>
  ): Promise<void> => {
    return getReactI18nCache()
      .lookupTranslationWithFallback(
        lookup.locale,
        lookup.message,
        lookup.options
      )
      .then(() => {
        this.emitTranslateEvent(lookup);
      })
      .catch((error) => this.logRuntimeTranslationError(error));
  };

  // ========== UseSyncExternalStore ========== //

  // ----- Subscriptions ----- //

  // Keep subscription methods as arrow fields so hooks can pass them by
  // reference without losing access to this store instance.
  subscribeToTranslate = <T extends Translation>(
    lookup: TranslateLookup<T>,
    listener: StoreListener
  ): Unsubscribe => {
    const lookupKey = getTranslateListenerKey(lookup);
    const wrappedListener: TranslateEventListener = (lookup) => {
      if (getTranslateListenerKey(lookup) === lookupKey) {
        listener();
      }
    };
    return subscribeToSet(this.translateListeners, wrappedListener);
  };

  subscribeToTranslationEvents = (
    listener: TranslateEventListener
  ): Unsubscribe => {
    return subscribeToSet(this.translateListeners, listener);
  };

  // ----- Snapshots ----- //

  getTranslateSnapshot = <T extends Translation>(
    lookup: TranslateLookup<T>,
    translationsSnapshot: Record<Locale, Record<Hash, Translation>> = {}
  ): TranslateSnapshot<T> => {
    return (
      lookupTranslation(translationsSnapshot, lookup) ??
      getReactI18nCache().lookupTranslation<T>(
        lookup.locale,
        lookup.message,
        lookup.options
      )
    );
  };

  // ----- Listener Utilities ----- //

  private emitTranslateEvent(event: TranslateLookup): void {
    this.translateListeners.forEach((listener) => listener(event));
  }
}
