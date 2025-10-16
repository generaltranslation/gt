import { CustomMapping } from 'generaltranslation/types';

// ----- UseDetermineLocale Hook ----- //
export type UseDetermineLocaleProps = {
  defaultLocale: string;
  locales: string[];
  locale?: string;
  localeCookieName?: string;
  ssr?: boolean;
  customMapping?: CustomMapping;
};

export type UseDetermineLocaleReturn = [string, (locale: string) => void];

// ----- UseLocaleState Hook ----- //
export type UseLocaleStateProps = {
  _locale: string;
  defaultLocale: string;
  locales: string[];
  ssr: boolean;
  localeCookieName: string;
  customMapping?: CustomMapping;
};

export type UseLocaleStateReturn = {
  locale: string;
  setLocale: (locale: string) => void;
  locales: string[];
  translationRequired: boolean;
  dialectTranslationRequired: boolean;
};
