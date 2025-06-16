import { useMemo } from 'react';
import { useDetermineLocale } from './useDetermineLocale';
import { GT } from 'generaltranslation';

export function useLocaleData({
  _locale,
  defaultLocale,
  locales: _locales,
  ssr,
  localeCookieName,
}: {
  _locale: string;
  defaultLocale: string;
  locales: string[];
  ssr: boolean;
  localeCookieName: string;
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
  });

  const [translationRequired, dialectTranslationRequired] = useMemo(() => {
    // User locale is not default locale or equivalent
    const translationRequired = GT.requiresTranslation(
      defaultLocale,
      locale,
      locales
    );

    // User locale is not default locale but is a dialect of the same language
    const dialectTranslationRequired =
      translationRequired && GT.isSameLanguage(defaultLocale, locale);

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
