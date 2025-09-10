import { useMemo } from 'react';
import { useDetermineLocale } from './useDetermineLocale';
import {
  requiresTranslation,
  isSameLanguage,
  isValidLocale,
} from 'generaltranslation';
import { CustomMapping } from 'generaltranslation/types';
import {
  invalidCanonicalLocalesError,
  invalidLocalesError,
} from '../../../errors/createErrors';

export function useLocaleState({
  _locale,
  defaultLocale,
  locales: _locales,
  ssr,
  localeCookieName,
  customMapping,
}: {
  _locale: string;
  defaultLocale: string;
  locales: string[];
  ssr: boolean;
  localeCookieName: string;
  customMapping?: CustomMapping;
}) {
  // Locale standardization
  const locales = useMemo(() => {
    return Array.from(new Set([defaultLocale, ..._locales]));
  }, [defaultLocale, _locales]);

  const [locale, setLocale] = useDetermineLocale({
    locale: _locale,
    defaultLocale,
    locales,
    ssr,
    localeCookieName,
    customMapping,
  });

  const [translationRequired, dialectTranslationRequired] = useMemo(() => {
    // User locale is not default locale or equivalent
    const translationRequired = requiresTranslation(
      defaultLocale,
      locale,
      locales
    );

    // User locale is not default locale but is a dialect of the same language
    const dialectTranslationRequired =
      translationRequired && isSameLanguage(defaultLocale, locale);

    // Check: invalid locale
    if (!customMapping) {
      const invalidLocales: string[] = [];
      locales.forEach((locale) => {
        if (!isValidLocale(locale)) {
          invalidLocales.push(locale);
        }
      });
      if (invalidLocales.length) {
        throw new Error(invalidLocalesError(invalidLocales));
      }
    }

    // Check: invalid canonical locale
    if (customMapping) {
      const invalidCanonicalLocales: string[] = [];
      locales.forEach((locale) => {
        if (!isValidLocale(locale, customMapping)) {
          invalidCanonicalLocales.push(locale);
        }
      });
      if (invalidCanonicalLocales.length) {
        throw new Error(invalidCanonicalLocalesError(invalidCanonicalLocales));
      }
    }

    return [translationRequired, dialectTranslationRequired];
  }, [defaultLocale, locale, locales]);

  return {
    locale, // the user's locale
    setLocale, // set the user's locale
    locales, // available locales
    translationRequired, // whether translation is required, e.g. "en" -> "fr"
    dialectTranslationRequired, // whether dialect translation is required, e.g. "en-US" to "en-GB"
  };
}
