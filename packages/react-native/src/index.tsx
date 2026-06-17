import { GTProvider } from './provider/GTProvider';
import {
  useSetLocale,
  useSetRegion,
  useSetEnableI18n,
} from './hooks/condition-store';
import { useLocaleSelector, useRegionSelector } from './hooks/selectors';
import { useLocaleDirection, useVersionId } from './hooks/utils';
import { getLocaleFromNativeStore } from './utils/nativeStore';
import { getLocale } from './utils/getLocale';
import { initializeGT } from './setup/initializeGT';
import type { GTProviderProps } from './provider/GTProvider';
import type { GetLocaleParams } from './utils/getLocale';
import type { InitializeGTParams } from './setup/initializeGT';

import type {
  DictionaryTranslationOptions,
  InlineTranslationOptions,
  RuntimeTranslationOptions,
} from '@generaltranslation/react-core/pure';
import type {
  RenderPipeline,
  RenderPreparedT,
} from '@generaltranslation/react-core/pure';

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
} from '@generaltranslation/react-core/components';

export {
  // ===== Hooks ===== //
  useLocale,
  useCustomMapping,
  useDefaultLocale,
  useEnableI18n,
  useLocales,
  useFormatLocales,
  useGT,
  useMessages,
  useTranslations,
} from '@generaltranslation/react-core/hooks';

export {
  // ===== Functions ===== //
  getFormatLocales,
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
} from '@generaltranslation/react-core/pure';

export {
  useRegion,
  useGTClass,
  useLocaleProperties,
} from '@generaltranslation/react-core/hooks';

export {
  GTProvider,
  useSetLocale,
  useSetRegion,
  useSetEnableI18n,
  useLocaleSelector,
  useRegionSelector,
  useLocaleDirection,
  useVersionId,
  getLocaleFromNativeStore,
  getLocale,
  initializeGT,
};

export type {
  DictionaryTranslationOptions,
  InlineTranslationOptions,
  RuntimeTranslationOptions,
  RenderPipeline,
  RenderPreparedT,
  GTProviderProps,
  GetLocaleParams,
  InitializeGTParams,
};
