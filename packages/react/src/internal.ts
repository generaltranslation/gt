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
  TranslatedContent,
  TranslationError,
  TranslationsObject,
  DictionaryEntry,
  TranslationSuccess,
  TranslationLoading,
  Children,
  FlattenedDictionary,
  Metadata,
  Child,
  GTProp,
  Entry,
  GTTranslationError,
  DictionaryTranslationOptions,
  InlineTranslationOptions,
  RuntimeTranslationOptions,
  LocalesDictionary,
  DictionaryContent,
  DictionaryObject,
  CustomLoader,
  RenderVariable,
  VariableProps,
} from './types/types';

import { GTContextType } from './types/context';
import { ClientProviderProps } from './types/config';
import { defaultLocaleCookieName } from './utils/cookies';
import mergeDictionaries from './dictionaries/mergeDictionaries';

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
  GTTranslationError,
  Metadata,
  getPluralBranch,
  getEntryAndMetadata,
  getVariableName,
  renderDefaultChildren,
  renderTranslatedChildren,
  renderSkeleton,
  RenderMethod,
  defaultRenderSettings,
  Children,
  Child,
  GTProp,
  Entry,
  TranslatedChildren,
  TranslatedContent,
  TranslationsObject,
  TranslationLoading,
  TranslationError,
  TranslationSuccess,
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
  mergeDictionaries,
};
