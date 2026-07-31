import type { JsxChildren } from 'generaltranslation/types';
import type { App, Ref } from 'vue';

export type TranslationCatalog = Record<string, JsxChildren>;

export type LoadTranslations = (locale: string) => Promise<TranslationCatalog>;

/** Options supported by gt-vue's plain string translations. */
export type GTStringOptions = {
  $context?: string;
};

export type GTFunction = (message: string, options?: GTStringOptions) => string;

export type MessagesFunction = <T extends string | null | undefined>(
  message: T,
  options?: GTStringOptions
) => T extends string ? string : T;

export type CreateGTOptions = {
  defaultLocale?: string;
  loadTranslations?: LoadTranslations;
  locale?: string;
};

export type GTPlugin = {
  getLocale(): string;
  install(app: App): void;
  loadTranslations(locale: string): Promise<TranslationCatalog>;
  setLocale(locale: string): Promise<void>;
};

/** Internal reactive state scoped to one installed plugin instance. */
export type GTState = {
  defaultLocale: string;
  getCatalog(): TranslationCatalog;
  loadTranslations(locale: string): Promise<TranslationCatalog>;
  locale: Ref<string>;
  revision: Ref<number>;
  setLocale(locale: string): Promise<void>;
};
