import {
  addGTIdentifier,
  writeChildrenAsObjects,
  isVariableObject,
  flattenDictionary,
  getDictionaryEntry,
  isValidDictionaryEntry,
  getVariableProps,
  getPluralBranch,
  getEntryAndMetadata,
  getVariableName,
  renderDefaultChildren,
  renderTranslatedChildren,
  renderSkeleton,
  defaultRenderSettings,
  defaultLocaleCookieName,
  defaultRegionCookieName,
  mergeDictionaries,
  reactHasUse,
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
} from '@generaltranslation/react-core/internal';

import {
  MFunctionType,
  TFunctionType,
  Dictionary,
  RenderMethod,
  TranslatedChildren,
  Translations,
  RenderVariable,
  VariableProps,
  DictionaryEntry,
  FlattenedDictionary,
  Metadata,
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
  GTContextType,
} from '@generaltranslation/react-core/types';

import { ClientProviderProps } from './types/config';

import { GTProp } from 'generaltranslation/types';

// Exports to move to gt-react/index
export {
  /** @deprecated use 'gt-react' instead */
  msg,
  /** @deprecated use 'gt-react' instead */
  decodeMsg,
  /** @deprecated use 'gt-react' instead */
  decodeOptions,
} from '@generaltranslation/react-core';

// Type exports
export type {
  RenderMethod,
  Dictionary,
  DictionaryEntry,
  FlattenedDictionary,
  Metadata,
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
  MFunctionType,
  TFunctionType,
  _Message,
  _Messages,
};

// Constant exports
export {
  defaultRenderSettings,
  defaultLocaleCookieName,
  defaultRegionCookieName,
  reactHasUse,
};

// Function exports
export {
  addGTIdentifier,
  writeChildrenAsObjects,
  isVariableObject,
  flattenDictionary,
  getDictionaryEntry,
  isValidDictionaryEntry,
  getVariableProps,
  getPluralBranch,
  getEntryAndMetadata,
  getVariableName,
  renderDefaultChildren,
  renderTranslatedChildren,
  renderSkeleton,
  mergeDictionaries,
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
};
