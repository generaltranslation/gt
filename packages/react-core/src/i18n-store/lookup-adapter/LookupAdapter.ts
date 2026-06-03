import type { Translation } from 'gt-i18n/types';
import type { RenderStrategy } from '../../setup/globals';
import type { RuntimeDictionaryScope } from '../RuntimeDictionaryScope';
import type { RuntimeTranslationScope } from '../RuntimeTranslationScope';
import type {
  DictionaryEntrySnapshot,
  DictionaryLookup,
  DictionaryObjectSnapshot,
  StoreListener,
  TranslateEventListener,
  TranslateLookup,
  TranslateManySnapshot,
  TranslateSnapshot,
  Unsubscribe,
} from '../storeTypes';

/**
 * Mode-aware boundary between React hooks and lookup storage.
 *
 * I18nStore owns mutable cache state and subscriptions. LookupAdapter owns
 * lookup policy: SPA uses the store as the source of truth, while SRA prefers
 * provider snapshots and only falls back to the store for dev hot reload.
 */
export type LookupAdapter = {
  mode: RenderStrategy;

  subscribeToTranslate: <T extends Translation>(
    lookup: TranslateLookup<T>,
    listener: StoreListener
  ) => Unsubscribe;

  /**
   * Used for scope subscriptions
   */
  subscribeToTranslationEvents: (
    listener: TranslateEventListener
  ) => Unsubscribe;

  /**
   * @deprecated
   */
  getTranslationSnapshot: <T extends Translation>(
    lookup: TranslateLookup<T>
  ) => TranslateSnapshot<T>;

  /**
   * Resolve methods define final precedence between server data and store data.
   */
  resolveTranslation: <T extends Translation>(
    lookup: TranslateLookup<T>,
    storeTranslation: TranslateSnapshot<T>
  ) => TranslateSnapshot<T>;

  handleMissingTranslation?: <T extends Translation>(
    lookup: TranslateLookup<T>
  ) => void;

  subscribeToTranslateMany: <T extends Translation>(
    lookups: readonly TranslateLookup<T>[],
    listener: StoreListener
  ) => Unsubscribe;

  getTranslationsSnapshot: <T extends Translation>(
    lookups: readonly TranslateLookup<T>[]
  ) => TranslateManySnapshot<T>;

  resolveTranslations: <T extends Translation>(
    lookups: readonly TranslateLookup<T>[],
    storeTranslations: TranslateManySnapshot<T>
  ) => TranslateManySnapshot<T>;

  /**
   * @deprecated
   */
  handleMissingTranslations?: <T extends Translation>(
    lookups: readonly TranslateLookup<T>[],
    translations: TranslateManySnapshot<T>
  ) => void;

  subscribeToDictionaryEntry: (
    lookup: DictionaryLookup,
    listener: StoreListener
  ) => Unsubscribe;

  getDictionaryEntrySnapshot: (
    lookup: DictionaryLookup
  ) => DictionaryEntrySnapshot;

  resolveDictionaryEntry: (
    lookup: DictionaryLookup,
    storeDictionaryEntry: DictionaryEntrySnapshot
  ) => DictionaryEntrySnapshot;

  handleMissingDictionaryEntry?: (lookup: DictionaryLookup) => void;

  subscribeToDictionaryObject: (
    lookup: DictionaryLookup,
    listener: StoreListener
  ) => Unsubscribe;

  getDictionaryObjectSnapshot: (
    lookup: DictionaryLookup
  ) => DictionaryObjectSnapshot;

  resolveDictionaryObject: (
    lookup: DictionaryLookup,
    storeDictionaryObject: DictionaryObjectSnapshot
  ) => DictionaryObjectSnapshot;

  handleMissingDictionaryObject?: (lookup: DictionaryLookup) => void;

  createRuntimeTranslationScope: () => RuntimeTranslationScope;
  createRuntimeDictionaryScope: () => RuntimeDictionaryScope;
};
