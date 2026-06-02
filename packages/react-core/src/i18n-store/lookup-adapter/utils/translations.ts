import { hashMessage } from 'gt-i18n/internal';
import type { Hash, Locale } from 'gt-i18n/internal/types';
import type { Translation } from 'gt-i18n/types';
import type {
  TranslateLookup,
  TranslateManySnapshot,
  TranslateSnapshot,
} from '../../storeTypes';

export function lookupTranslation<T extends Translation>(
  translationsSnapshot: Record<Locale, Record<Hash, Translation>> | undefined,
  lookup: TranslateLookup<T>
): TranslateSnapshot<T> {
  const hash =
    lookup.options.$_hash ?? hashMessage(lookup.message, lookup.options);
  return translationsSnapshot?.[lookup.locale]?.[hash] as TranslateSnapshot<T>;
}

export function lookupTranslations<T extends Translation>(
  translationsSnapshot: Record<Locale, Record<Hash, Translation>> | undefined,
  lookups: readonly TranslateLookup<T>[],
  storeTranslations?: TranslateManySnapshot<T>
): TranslateManySnapshot<T> {
  return lookups.map(
    (lookup, index) =>
      lookupTranslation(translationsSnapshot, lookup) ??
      storeTranslations?.[index]
  );
}
