import { getI18nConfig, hashMessage } from 'gt-i18n/internal';
import type { Hash, Locale } from 'gt-i18n/internal/types';
import type { Translation } from 'gt-i18n/types';
import type { TranslateLookup, TranslateSnapshot } from '../storeTypes';

export function lookupTranslation<T extends Translation>(
  translationsSnapshot: Record<Locale, Record<Hash, Translation>> | undefined,
  lookup: TranslateLookup<T>
): TranslateSnapshot<T> {
  const translationLocale = resolveTranslationLocale(lookup.locale);
  if (!translationLocale) return lookup.message;

  const hash =
    lookup.options.$_hash ?? hashMessage(lookup.message, lookup.options);
  const translation = translationsSnapshot?.[translationLocale]?.[hash];
  return (
    translation !== undefined || translationLocale === lookup.locale
      ? translation
      : translationsSnapshot?.[lookup.locale]?.[hash]
  ) as TranslateSnapshot<T>;
}

function resolveTranslationLocale(locale: string): string | undefined {
  try {
    return getI18nConfig().resolveTranslationLocale(locale);
  } catch {
    return locale;
  }
}
