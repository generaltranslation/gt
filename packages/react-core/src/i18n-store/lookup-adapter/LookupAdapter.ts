import type { Translation } from 'gt-i18n/types';
import type { RuntimeDictionaryScope } from '../RuntimeDictionaryScope';
import type { RuntimeTranslationScope } from '../RuntimeTranslationScope';
import type {
  DictionaryEntrySnapshot,
  DictionaryLookup,
  DictionaryObjectSnapshot,
  StoreListener,
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
  mode: 'spa' | 'sra';

  subscribeToTranslate: <T extends Translation>(
    lookup: TranslateLookup<T>,
    listener: StoreListener
  ) => Unsubscribe;

  /**
   * Store lookups read I18nStore. This is authoritative in SPA and a dev-only
   * hot reload fallback in SRA.
   */
  getStoreTranslation: <T extends Translation>(
    lookup: TranslateLookup<T>
  ) => TranslateSnapshot<T>;

  /**
   * Server lookups read provider-distributed snapshots in SRA. SPA mirrors the
   * store here so hooks can keep a single useSyncExternalStore shape.
   */
  getServerTranslation: <T extends Translation>(
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

  getStoreTranslations: <T extends Translation>(
    lookups: readonly TranslateLookup<T>[]
  ) => TranslateManySnapshot<T>;

  getServerTranslations: <T extends Translation>(
    lookups: readonly TranslateLookup<T>[]
  ) => TranslateManySnapshot<T>;

  resolveTranslations: <T extends Translation>(
    lookups: readonly TranslateLookup<T>[],
    storeTranslations: TranslateManySnapshot<T>
  ) => TranslateManySnapshot<T>;

  handleMissingTranslations?: <T extends Translation>(
    lookups: readonly TranslateLookup<T>[],
    translations: TranslateManySnapshot<T>
  ) => void;

  subscribeToDictionaryEntry: (
    lookup: DictionaryLookup,
    listener: StoreListener
  ) => Unsubscribe;

  getStoreDictionaryEntry: (
    lookup: DictionaryLookup
  ) => DictionaryEntrySnapshot;

  getServerDictionaryEntry: (
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

  getStoreDictionaryObject: (
    lookup: DictionaryLookup
  ) => DictionaryObjectSnapshot;

  getServerDictionaryObject: (
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
