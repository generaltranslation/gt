import type { Adapter, Secrets } from '../types';
import { gt, pluginConfig } from './core';

// note: this function is used to get the available locales for a project
export const getLocales: Adapter['getLocales'] = async (
  _secrets: Secrets | null
) => {
  // An original written in another locale is translated into the source
  // locale too, so it is offered as a target. Each document drops its own
  // language from the targets it is translated into.
  const localeIds = pluginConfig.getAllowNonDefaultSourceLocales()
    ? [pluginConfig.getSourceLocale(), ...pluginConfig.getLocales()]
    : pluginConfig.getLocales();
  return localeIds.map((locale: string) => ({
    localeId: locale,
    description: gt.getLocaleProperties(locale).name,
    enabled: true,
  }));
};
