export { Branch, Plural } from './components/branches';
export { T } from './components/T';
export { Currency, DateTime, Num, Var } from './components/variables';
export { useLocale, useSetLocale } from './composables/locale';
export { useGT, useMessages } from './composables/strings';
export { msg } from './messages/msg';
export { initializeGTSPA, t } from './runtime/spa';
export { createGT } from './runtime/state';
export type {
  CreateGTOptions,
  GTFunction,
  GTPlugin,
  GTStringOptions,
  InitializeGTSPAOptions,
  LoadTranslations,
  MessagesFunction,
  TranslationCatalog,
} from './types';
