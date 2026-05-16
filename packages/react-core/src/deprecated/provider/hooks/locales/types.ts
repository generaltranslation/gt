import type { CustomMapping } from '@generaltranslation/format/types';

export type UseDetermineLocaleParams = {
  defaultLocale: string;
  locales: string[];
  enableI18n: boolean;
  locale?: string;
  localeCookieName?: string;
  ssr?: boolean;
  customMapping?: CustomMapping;
  reloadOnLocaleUpdate?: boolean;
};

export type UseDetermineLocaleReturn = [string, (locale: string) => void];
