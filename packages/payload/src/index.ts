export { gtPlugin } from './plugin/plugin';
export type { GtPluginOptions } from './plugin/plugin';
export {
  saveSiteTranslations,
  saveTranslations,
  translateDocument,
  translateSite,
} from './translation/translation';
export type {
  DocumentResult,
  SaveTranslationsResult,
  SiteResult,
  TranslateDocumentInput,
  TranslateSiteInput,
} from './translation/translation';
export type {
  GtClient,
  LocaleResult,
  SkippedReason,
  SkippedString,
  TranslateResult,
  TranslateTarget,
} from './types/types';
