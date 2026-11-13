import { hashContent } from 'gt-i18n/internal';
import type { Hash, Locale } from 'gt-i18n/internal/types';
import type { Content } from '@generaltranslation/format/types';
import type { TranslateLookup, TranslateSnapshot } from '../storeTypes';

export function lookupTranslation<T extends Content>(
  translationsSnapshot: Record<Locale, Record<Hash, Content>> | undefined,
  lookup: TranslateLookup<T>
): TranslateSnapshot<T> {
  const hash =
    lookup.options.$_hash ?? hashContent(lookup.content, lookup.options);
  return translationsSnapshot?.[lookup.locale]?.[hash] as TranslateSnapshot<T>;
}
