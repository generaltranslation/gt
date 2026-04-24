import type { MFunctionType, GTFunctionType } from './types-dir/types';
import type {
  Dictionary,
  RenderMethod,
  TranslatedChildren,
  Translations,
  RenderVariable,
  VariableProps,
  DictionaryEntry,
  FlattenedDictionary,
  MetaEntry,
  Entry,
  DictionaryTranslationOptions,
  InlineTranslationOptions,
  RuntimeTranslationOptions,
  LocalesDictionary,
  DictionaryContent,
  DictionaryObject,
  CustomLoader,
  _Message,
  _Messages,
  TaggedChildren,
} from './types-dir/types';
import type { GTContextType } from './types-dir/context';

import type { AuthFromEnvParams, AuthFromEnvReturn } from './utils/types';
import type {
  UseDetermineLocaleParams,
  UseDetermineLocaleReturn,
} from './provider/hooks/locales/types';
import type {
  UseRegionStateParams,
  UseRegionStateReturn,
  UseEnableI18nParams,
  UseEnableI18nReturn,
} from './provider/hooks/types';
import type { LocaleSelectorProps, RegionSelectorProps } from './ui/types';

import type { GTProp } from 'generaltranslation/types';

import type { InternalGTProviderProps, GTConfig } from './types-dir/config';

export type {
  Dictionary,
  DictionaryEntry,
  FlattenedDictionary,
  RenderMethod,
  GTProp,
  Entry,
  TranslatedChildren,
  Translations,
  GTContextType,
  DictionaryTranslationOptions,
  InlineTranslationOptions,
  RuntimeTranslationOptions,
  DictionaryContent,
  DictionaryObject,
  LocalesDictionary,
  CustomLoader,
  RenderVariable,
  VariableProps,
  MetaEntry as Metadata,
  _Message,
  _Messages,
  MFunctionType,
  GTFunctionType,
  LocaleSelectorProps,
  RegionSelectorProps,
  InternalGTProviderProps,
  AuthFromEnvParams,
  AuthFromEnvReturn,
  UseDetermineLocaleParams,
  UseDetermineLocaleReturn,
  UseRegionStateParams,
  UseRegionStateReturn,
  UseEnableI18nParams,
  UseEnableI18nReturn,
  GTConfig,
  TaggedChildren,
};
