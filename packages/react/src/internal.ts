import flattenDictionary from './internal/flattenDictionary';
import addGTIdentifier from './internal/addGTIdentifier';
import writeChildrenAsObjects from './internal/writeChildrenAsObjects';
import getPluralBranch from './branches/plurals/getPluralBranch';
import {
  getDictionaryEntry,
  isValidDictionaryEntry,
} from './dictionaries/getDictionaryEntry';
import getEntryAndMetadata from './dictionaries/getEntryAndMetadata';
import getVariableProps from './variables/_getVariableProps';
import isVariableObject from './rendering/isVariableObject';
import getVariableName from './variables/getVariableName';
import renderDefaultChildren from './rendering/renderDefaultChildren';
import renderTranslatedChildren from './rendering/renderTranslatedChildren';
import { defaultRenderSettings } from './rendering/defaultRenderSettings';
import renderSkeleton from './rendering/renderSkeleton';
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
  TranslationsStatus,
} from './types/types';

import { GTContextType } from './types/context';
import { ClientProviderProps } from './types/config';
import {
  defaultLocaleCookieName,
  defaultRegionCookieName,
} from './utils/cookies';
import mergeDictionaries from './dictionaries/mergeDictionaries';
import { GTProp } from 'generaltranslation/types';

export {
  addGTIdentifier,
  writeChildrenAsObjects,
  isVariableObject,
  Dictionary,
  flattenDictionary,
  getDictionaryEntry,
  isValidDictionaryEntry,
  getVariableProps,
  DictionaryEntry,
  FlattenedDictionary,
  MetaEntry as Metadata,
  getPluralBranch,
  getEntryAndMetadata,
  getVariableName,
  renderDefaultChildren,
  renderTranslatedChildren,
  renderSkeleton,
  RenderMethod,
  defaultRenderSettings,
  GTProp,
  Entry,
  TranslatedChildren,
  Translations,
  TranslationsStatus,
  GTContextType,
  ClientProviderProps,
  DictionaryTranslationOptions,
  InlineTranslationOptions,
  RuntimeTranslationOptions,
  DictionaryContent,
  DictionaryObject,
  LocalesDictionary,
  CustomLoader,
  RenderVariable,
  VariableProps,
  defaultLocaleCookieName,
  defaultRegionCookieName,
  mergeDictionaries,
};
