import { hashMessage, type Hash, type Locale } from 'gt-i18n/internal';
import type { Content } from '@generaltranslation/format';
import type { TranslateLookup, TranslateSnapshot } from '../storeTypes';

export function lookupTranslation<T extends Content>(
  translationsSnapshot: Record<Locale, Record<Hash, Content>> | undefined,
  lookup: TranslateLookup<T>
): TranslateSnapshot<T> {
  const hash =
    lookup.options.$_hash ?? hashMessage(lookup.message, lookup.options);
  return translationsSnapshot?.[lookup.locale]?.[hash] as TranslateSnapshot<T>;
}
