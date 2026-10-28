export { default as T } from './components/T.svelte';
export { default as GTProvider } from './components/GTProvider.svelte';
export { default as Var } from './components/Var.svelte';
export { default as Num } from './components/Num.svelte';
export { default as Currency } from './components/Currency.svelte';
export { default as DateTime } from './components/DateTime.svelte';
export { default as RelativeTime } from './components/RelativeTime.svelte';
export { default as Branch } from './components/Branch.svelte';
export { default as Plural } from './components/Plural.svelte';
export {
  getLocaleDirection,
  initializeGT,
  loadTranslations,
  resolveLocale,
} from './runtime/config';
export type { GTSvelteConfig, GTTranslationsData } from './runtime/config';
export {
  useDefaultLocale,
  useGT,
  useLocale,
  useLocaleDirection,
  useLocaleProperties,
  useLocales,
  useMessages,
  useSetLocale,
} from './runtime/strings';
export { msg } from 'gt-i18n';
export type { LocaleProperties } from '@generaltranslation/format/types';
export type {
  GTFunctionType,
  GTTranslationOptions,
  MFunctionType,
} from 'gt-i18n/types';
