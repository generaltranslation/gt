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
 * Adapter boundary for translation lookups.
 *
 * The public hook can stay shared while SPA and SRA keep separate cache,
 * validation, and missing-translation semantics behind this interface.
 */
export type LookupAdapter = {
  mode: 'spa' | 'sra';

  subscribeToTranslate: <T extends Translation>(
    lookup: TranslateLookup<T>,
    listener: StoreListener
  ) => Unsubscribe;

  getStoreTranslation: <T extends Translation>(
    lookup: TranslateLookup<T>
  ) => TranslateSnapshot<T>;

  getServerTranslation: <T extends Translation>(
    lookup: TranslateLookup<T>
  ) => TranslateSnapshot<T>;

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
