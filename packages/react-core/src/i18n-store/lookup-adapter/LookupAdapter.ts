import { hashMessage } from 'gt-i18n/internal';
import type { Hash, Locale } from 'gt-i18n/internal/types';
import type { Translation } from 'gt-i18n/types';
import type {
  StoreListener,
  TranslateLookup,
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

  getExternalTranslateSnapshot: <T extends Translation>(
    lookup: TranslateLookup<T>
  ) => TranslateSnapshot<T>;

  getServerTranslateSnapshot: <T extends Translation>(
    lookup: TranslateLookup<T>
  ) => TranslateSnapshot<T>;

  resolveTranslateSnapshot: <T extends Translation>(
    lookup: TranslateLookup<T>,
    externalSnapshot: TranslateSnapshot<T>
  ) => TranslateSnapshot<T>;

  handleMissingTranslateSnapshot?: <T extends Translation>(
    lookup: TranslateLookup<T>
  ) => void;
};

export function lookupTranslationSnapshot<T extends Translation>(
  translationsSnapshot:
    | Record<Locale, Record<Hash, Translation>>
    | undefined,
  lookup: TranslateLookup<T>
): TranslateSnapshot<T> {
  const hash =
    lookup.options.$_hash ?? hashMessage(lookup.message, lookup.options);
  return translationsSnapshot?.[lookup.locale]?.[hash] as TranslateSnapshot<T>;
}
