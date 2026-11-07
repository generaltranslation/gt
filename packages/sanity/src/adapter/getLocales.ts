import type { TranslationLocale } from '../types';
import { pluginConfig } from './core';
import { allowsNonDefaultSourceLocales } from '../utils/translationSource';

/**
 * The plugin's target locales, all enabled.
 *
 * @param sourceLanguage - Language of the document being translated, when
 *   known. With `allowNonDefaultSourceLocales`, an original written in another
 *   locale is translated into the configured source locale too, so it is
 *   offered as a target for that original only.
 */
export const getLocales = (sourceLanguage?: string): TranslationLocale[] => {
  const sourceLocale = pluginConfig.getSourceLocale();
  const localeIds =
    allowsNonDefaultSourceLocales() &&
    sourceLanguage &&
    sourceLanguage !== sourceLocale
      ? [sourceLocale, ...pluginConfig.getLocales()]
      : pluginConfig.getLocales();
  return localeIds.map((locale: string) => ({
    localeId: locale,
    enabled: true,
  }));
};
