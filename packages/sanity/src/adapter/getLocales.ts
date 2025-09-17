import type { Adapter, Secrets } from '../types';
import { gt, gtConfig, overrideConfig } from './core';

// note: this function is used to get the available locales for a project
export const getLocales: Adapter['getLocales'] = async (
  secrets: Secrets | null
) => {
  return gtConfig.getLocales().map((locale: string) => ({
    localeId: locale,
    description: gt.getLocaleProperties(locale).languageName,
    enabled: true,
  }));
};
