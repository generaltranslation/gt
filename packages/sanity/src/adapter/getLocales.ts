import type { TranslationLocale } from '../types';
import { pluginConfig } from './core';

/** The plugin's target locales, all enabled. */
export const getLocales = (): TranslationLocale[] =>
  pluginConfig.getLocales().map((locale: string) => ({
    localeId: locale,
    enabled: true,
  }));
