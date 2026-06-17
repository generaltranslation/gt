import { getReactI18nCache } from '@generaltranslation/react-core/context';
import type { Hash } from 'gt-i18n/internal/types';
import type { Translation } from 'gt-i18n/types';

export type LocaleTranslations = Record<Hash, Translation>;

const translationPromises = new WeakMap<
  object,
  Map<string, Promise<LocaleTranslations>>
>();

export function loadTranslations(locale: string): Promise<LocaleTranslations> {
  const i18nCache = getReactI18nCache();
  let i18nCacheTranslationPromises = translationPromises.get(i18nCache);
  if (i18nCacheTranslationPromises == null) {
    i18nCacheTranslationPromises = new Map();
    translationPromises.set(i18nCache, i18nCacheTranslationPromises);
  }

  let promise = i18nCacheTranslationPromises.get(locale);
  if (promise == null) {
    // TODO: Support promise caching in i18nCache in a separate PR.
    promise = i18nCache.loadTranslations(locale).catch((error: unknown) => {
      i18nCacheTranslationPromises.delete(locale);
      console.warn(
        `Failed to load translations for locale "${locale}". Falling back to an empty translation snapshot.`,
        error
      );
      return {};
    });
    i18nCacheTranslationPromises.set(locale, promise);
  }
  return promise;
}
