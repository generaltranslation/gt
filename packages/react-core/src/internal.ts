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
import { msg, decodeMsg, decodeOptions } from './messages/messages';
import { MFunctionType, TFunctionType } from './types/types';
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
} from './types/types';

import { GTContextType } from './types/context';
import { ClientProviderProps } from './types/config';
import {
  defaultLocaleCookieName,
  defaultRegionCookieName,
} from './utils/cookies';
import mergeDictionaries from './dictionaries/mergeDictionaries';
import { GTProp } from 'generaltranslation/types';
import { reactHasUse } from './promises/reactHasUse';
import { getSubtree, getSubtreeWithCreation } from './dictionaries/getSubtree';
import { injectEntry } from './dictionaries/injectEntry';
import { isDictionaryEntry } from './dictionaries/isDictionaryEntry';
import { stripMetadataFromEntries } from './dictionaries/stripMetadataFromEntries';
import { injectHashes } from './dictionaries/injectHashes';
import { injectTranslations } from './dictionaries/injectTranslations';
import { injectFallbacks } from './dictionaries/injectFallbacks';
import { injectAndMerge } from './dictionaries/injectAndMerge';
import { collectUntranslatedEntries } from './dictionaries/collectUntranslatedEntries';
import {
  UseDetermineLocaleProps,
  UseDetermineLocaleReturn,
  UseLocaleStateProps,
  UseLocaleStateReturn,
} from './provider/hooks/locales/types';

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
  _Message,
  _Messages,
  reactHasUse,
  msg,
  decodeMsg,
  decodeOptions,
  MFunctionType,
  TFunctionType,
  getSubtree,
  getSubtreeWithCreation,
  injectEntry,
  isDictionaryEntry,
  stripMetadataFromEntries,
  injectHashes,
  injectTranslations,
  injectFallbacks,
  injectAndMerge,
  collectUntranslatedEntries,
  UseDetermineLocaleProps,
  UseDetermineLocaleReturn,
  UseLocaleStateProps,
  UseLocaleStateReturn,
};
