import type { Adapter, Secrets } from '../types';
import { gt, pluginConfig } from './core';
import { allowsNonDefaultSourceLocales } from '../utils/translationSource';

// note: this function is used to get the available locales for a project
export const getLocales: Adapter['getLocales'] = async (
  _secrets: Secrets | null,
  sourceLanguage?: string
) => {
  // With `allowNonDefaultSourceLocales`, an original written in another
  // locale is translated into the configured source locale too, so it is
  // offered as a target for that original only.
  const sourceLocale = pluginConfig.getSourceLocale();
  const localeIds =
    allowsNonDefaultSourceLocales() &&
    sourceLanguage &&
    sourceLanguage !== sourceLocale
      ? [sourceLocale, ...pluginConfig.getLocales()]
      : pluginConfig.getLocales();
  return localeIds.map((locale: string) => ({
    localeId: locale,
    description: gt.getLocaleProperties(locale).name,
    enabled: true,
  }));
};
