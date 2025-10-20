import { CustomMapping } from 'generaltranslation/types';

export type UseDetermineLocaleParams = {
  defaultLocale: string;
  locales: string[];
  locale?: string;
  localeCookieName?: string;
  ssr?: boolean;
  customMapping?: CustomMapping;
};

export type UseDetermineLocaleReturn = [string, (locale: string) => void];
