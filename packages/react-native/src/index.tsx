import { initializeGTSPA } from './setup/initializeGTSPA';
import { useSetLocale, useSetEnableI18n } from './hooks/condition-store';
import { getLocaleFromNativeStore } from './utils/nativeStore';
import type { InitializeGTSPAParams } from './setup/initializeGTSPA';

import type {
  DictionaryTranslationOptions,
  InlineTranslationOptions,
  RuntimeTranslationOptions,
} from '@generaltranslation/react-core/types';
import type {
  RenderPipeline,
  RenderPreparedT,
} from '@generaltranslation/react-core/context';

export {
  // ===== Components ===== //
  Branch,
  Plural,
  Derive,
  T,
  Currency,
  DateTime,
  RelativeTime,
  Var,
  Num,
  // ===== Hooks ===== //
  useLocale,
  useCustomMapping,
  useDefaultLocale,
  useEnableI18n,
  useLocales,
  getFormatLocales,
  useFormatLocales,
  useGT,
  useMessages,
  useTranslations,
  // ===== Functions ===== //
  msg,
  decodeMsg,
  decodeOptions,
  derive,
  declareVar,
  decodeVars,
  mFallback,
  gtFallback,
  getTranslationsSnapshot,
  getReactI18nCache,
  setReactI18nCache,
  createRenderPipeline,
  t,
} from '@generaltranslation/react-core/context';

export {
  initializeGTSPA,
  useSetLocale,
  useSetEnableI18n,
  getLocaleFromNativeStore,
};

export type {
  DictionaryTranslationOptions,
  InlineTranslationOptions,
  RuntimeTranslationOptions,
  RenderPipeline,
  RenderPreparedT,
  InitializeGTSPAParams,
};
