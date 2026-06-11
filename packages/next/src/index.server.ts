import 'server-only';

// ===== Overrides ===== //
export {
  /**
   * @deprecated import from 'gt-next/server' instead
   */
  Tx
} from './server';

// ===== gt-react ===== //
export {
// ----- components ----- //
  GTProvider,
  Var,
  Num,
  Currency,
  DateTime,
  RelativeTime,
  Derive,
  Branch,
  Plural,
  T,
  LocaleSelector,
  // ----- hooks ----- //
  useGT,
  useTranslations,
  useMessages,
  useLocale,
  useLocaleDirection,
  useVersionId,
  useLocales,
  useDefaultLocale,
  useGTClass,
  useLocaleProperties,
  // ----- functions ----- //
  msg,
  decodeMsg,
  decodeOptions,
  declareVar,
  decodeVars,
  derive,
  mFallback,
  gtFallback,
} from 'gt-react/context';
import type {
  DictionaryTranslationOptions,
  InlineTranslationOptions,
  RuntimeTranslationOptions,
} from 'gt-react';

// ===== other ===== //
import { initializeGT } from 'gt-react/context';

const publicI18nConfigParams =
  process.env.NEXT_PUBLIC_GENERALTRANSLATION_I18N_CONFIG_PARAMS;

console.log('SSR')
console.log('SSR: publicI18nConfigParams', publicI18nConfigParams);

if (publicI18nConfigParams) {
  console.log('SSR: initializing GT');
  initializeGT(JSON.parse(publicI18nConfigParams));
}


export type {
  DictionaryTranslationOptions,
  InlineTranslationOptions,
  RuntimeTranslationOptions,
};
