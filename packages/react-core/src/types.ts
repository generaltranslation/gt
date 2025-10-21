import { MFunctionType, TFunctionType } from './types-dir/types';
import {
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
} from './types-dir/types';
import { GTContextType } from './types-dir/context';

import { AuthFromEnvParams, AuthFromEnvReturn } from './utils/types';
import {
  UseDetermineLocaleParams,
  UseDetermineLocaleReturn,
} from './provider/hooks/locales/types';
import {
  UseRegionStateParams,
  UseRegionStateReturn,
} from './provider/hooks/types';
import { LocaleSelectorProps, RegionSelectorProps } from './ui/types';

import { GTProp } from 'generaltranslation/types';

import { InternalGTProviderProps, GTConfig } from './types-dir/config';

export {
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
  TFunctionType,
  LocaleSelectorProps,
  RegionSelectorProps,
  InternalGTProviderProps,
  AuthFromEnvParams,
  AuthFromEnvReturn,
  UseDetermineLocaleParams,
  UseDetermineLocaleReturn,
  UseRegionStateParams,
  UseRegionStateReturn,
  GTConfig,
};
