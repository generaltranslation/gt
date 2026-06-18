// No useContext related exports should go through here!

import {
  addGTIdentifier as _addGTIdentifier,
  writeChildrenAsObjects as _writeChildrenAsObjects,
  isVariableObject as _isVariableObject,
  flattenDictionary as _flattenDictionary,
  getDictionaryEntry as _getDictionaryEntry,
  isValidDictionaryEntry as _isValidDictionaryEntry,
  getVariableProps as _getVariableProps,
  getPluralBranch as _getPluralBranch,
  getEntryAndMetadata as _getEntryAndMetadata,
  getVariableName as _getVariableName,
  renderSkeleton as _renderSkeleton,
  getDefaultRenderSettings as _getDefaultRenderSettings,
  mergeDictionaries as _mergeDictionaries,
  reactHasUse as _reactHasUse,
  getSubtree as _getSubtree,
  getSubtreeWithCreation as _getSubtreeWithCreation,
  injectEntry as _injectEntry,
  isDictionaryEntry as _isDictionaryEntry,
  stripMetadataFromEntries as _stripMetadataFromEntries,
  injectHashes as _injectHashes,
  injectTranslations as _injectTranslations,
  injectFallbacks as _injectFallbacks,
  injectAndMerge as _injectAndMerge,
  collectUntranslatedEntries as _collectUntranslatedEntries,
  msg as _msg,
  decodeMsg as _decodeMsg,
  decodeOptions as _decodeOptions,
  derive as _derive,
  declareVar as _declareVar,
  decodeVars as _decodeVars,
  mFallback as _mFallback,
  gtFallback as _gtFallback,
} from '@generaltranslation/react-core/pure';
import {
  Derive as _Derive,
  renderDefaultChildren as _renderDefaultChildren,
  renderTranslatedChildren as _renderTranslatedChildren,
} from '@generaltranslation/react-core/components-rsc';
import {
  defaultEnableI18nCookieName as _defaultEnableI18nCookieName,
  defaultLocaleCookieName as _defaultLocaleCookieName,
  defaultRegionCookieName as _defaultRegionCookieName,
} from './cookie-names';

import type {
  MFunctionType as _MFunctionType,
  GTFunctionType as _GTFunctionType,
  Dictionary as _Dictionary,
  RenderMethod as _RenderMethod,
  TranslatedChildren as _TranslatedChildren,
  Translations as _Translations,
  RenderVariable as _RenderVariable,
  VariableProps as _VariableProps,
  DictionaryEntry as _DictionaryEntry,
  FlattenedDictionary as _FlattenedDictionary,
  Metadata as _Metadata,
  Entry as _Entry,
  DictionaryTranslationOptions as _DictionaryTranslationOptions,
  InlineTranslationOptions as _InlineTranslationOptions,
  RuntimeTranslationOptions as _RuntimeTranslationOptions,
  LocalesDictionary as _LocalesDictionary,
  DictionaryContent as _DictionaryContent,
  DictionaryObject as _DictionaryObject,
  CustomLoader as _CustomLoader,
  _Message as __Message,
  _Messages as __Messages,
  GTProp as _GTProp,
} from '@generaltranslation/react-core/pure';

import type { SharedGTProviderProps } from './provider/GTProviderProps';

/**
 * @deprecated gt-react/internal is deprecated. Use public gt-react exports instead.
 */
type RenderMethod = _RenderMethod;

/**
 * @deprecated gt-react/internal is deprecated. Use public gt-react exports instead.
 */
type Dictionary = _Dictionary;

/**
 * @deprecated gt-react/internal is deprecated. Use public gt-react exports instead.
 */
type DictionaryEntry = _DictionaryEntry;

/**
 * @deprecated gt-react/internal is deprecated. Use public gt-react exports instead.
 */
type FlattenedDictionary = _FlattenedDictionary;

/**
 * @deprecated gt-react/internal is deprecated. Use public gt-react exports instead.
 */
type Metadata = _Metadata;

/**
 * @deprecated gt-react/internal is deprecated. Use public gt-react exports instead.
 */
type GTProp = _GTProp;

/**
 * @deprecated gt-react/internal is deprecated. Use public gt-react exports instead.
 */
type Entry = _Entry;

/**
 * @deprecated gt-react/internal is deprecated. Use public gt-react exports instead.
 */
type TranslatedChildren = _TranslatedChildren;

/**
 * @deprecated gt-react/internal is deprecated. Use public gt-react exports instead.
 */
type Translations = _Translations;

/**
 * @deprecated gt-react/internal is deprecated. Use SharedGTProviderProps from gt-react instead.
 */
type ClientProviderProps = SharedGTProviderProps;

/**
 * @deprecated gt-react/internal is deprecated. Use SharedGTProviderProps from gt-react instead.
 */
type GTProviderProps = SharedGTProviderProps;

/**
 * @deprecated gt-react/internal is deprecated. Use public gt-react exports instead.
 */
type DictionaryTranslationOptions = _DictionaryTranslationOptions;

/**
 * @deprecated gt-react/internal is deprecated. Use public gt-react exports instead.
 */
type InlineTranslationOptions = _InlineTranslationOptions;

/**
 * @deprecated gt-react/internal is deprecated. Use public gt-react exports instead.
 */
type RuntimeTranslationOptions = _RuntimeTranslationOptions;

/**
 * @deprecated gt-react/internal is deprecated. Use public gt-react exports instead.
 */
type DictionaryContent = _DictionaryContent;

/**
 * @deprecated gt-react/internal is deprecated. Use public gt-react exports instead.
 */
type DictionaryObject = _DictionaryObject;

/**
 * @deprecated gt-react/internal is deprecated. Use public gt-react exports instead.
 */
type LocalesDictionary = _LocalesDictionary;

/**
 * @deprecated gt-react/internal is deprecated. Use public gt-react exports instead.
 */
type CustomLoader = _CustomLoader;

/**
 * @deprecated gt-react/internal is deprecated. Use public gt-react exports instead.
 */
type RenderVariable = _RenderVariable;

/**
 * @deprecated gt-react/internal is deprecated. Use public gt-react exports instead.
 */
type VariableProps = _VariableProps;

/**
 * @deprecated gt-react/internal is deprecated. Use public gt-react exports instead.
 */
type MFunctionType = _MFunctionType;

/**
 * @deprecated gt-react/internal is deprecated. Use public gt-react exports instead.
 */
type GTFunctionType = _GTFunctionType;

/**
 * @deprecated gt-react/internal is deprecated. Use public gt-react exports instead.
 */
type _Message = __Message;

/**
 * @deprecated gt-react/internal is deprecated. Use public gt-react exports instead.
 */
type _Messages = __Messages;

/**
 * @deprecated gt-react/internal is deprecated. Use public gt-react exports instead.
 */
const defaultEnableI18nCookieName = _defaultEnableI18nCookieName;

/**
 * @deprecated gt-react/internal is deprecated. Use public gt-react exports instead.
 */
const defaultLocaleCookieName = _defaultLocaleCookieName;

/**
 * @deprecated gt-react/internal is deprecated. Use public gt-react exports instead.
 */
const defaultRegionCookieName = _defaultRegionCookieName;

/**
 * @deprecated gt-react/internal is deprecated. Use public gt-react exports instead.
 */
const reactHasUse = _reactHasUse;

/**
 * @deprecated gt-react/internal is deprecated. Use public gt-react exports instead.
 */
const Derive = _Derive;

/**
 * @deprecated gt-react/internal is deprecated. Use public gt-react exports instead.
 */
const addGTIdentifier = _addGTIdentifier;

/**
 * @deprecated gt-react/internal is deprecated. Use public gt-react exports instead.
 */
const writeChildrenAsObjects = _writeChildrenAsObjects;

/**
 * @deprecated gt-react/internal is deprecated. Use public gt-react exports instead.
 */
const isVariableObject = _isVariableObject;

/**
 * @deprecated gt-react/internal is deprecated. Use public gt-react exports instead.
 */
const flattenDictionary = _flattenDictionary;

/**
 * @deprecated gt-react/internal is deprecated. Use public gt-react exports instead.
 */
const getDictionaryEntry = _getDictionaryEntry;

/**
 * @deprecated gt-react/internal is deprecated. Use public gt-react exports instead.
 */
const isValidDictionaryEntry = _isValidDictionaryEntry;

/**
 * @deprecated gt-react/internal is deprecated. Use public gt-react exports instead.
 */
const getVariableProps = _getVariableProps;

/**
 * @deprecated gt-react/internal is deprecated. Use public gt-react exports instead.
 */
const getPluralBranch = _getPluralBranch;

/**
 * @deprecated gt-react/internal is deprecated. Use public gt-react exports instead.
 */
const getEntryAndMetadata = _getEntryAndMetadata;

/**
 * @deprecated gt-react/internal is deprecated. Use public gt-react exports instead.
 */
const getVariableName = _getVariableName;

/**
 * @deprecated gt-react/internal is deprecated. Use public gt-react exports instead.
 */
const renderDefaultChildren = _renderDefaultChildren;

/**
 * @deprecated gt-react/internal is deprecated. Use public gt-react exports instead.
 */
const renderTranslatedChildren = _renderTranslatedChildren;

/**
 * @deprecated gt-react/internal is deprecated. Use public gt-react exports instead.
 */
const renderSkeleton = _renderSkeleton;

/**
 * @deprecated gt-react/internal is deprecated. Use public gt-react exports instead.
 */
const mergeDictionaries = _mergeDictionaries;

/**
 * @deprecated gt-react/internal is deprecated. Use public gt-react exports instead.
 */
const getSubtree = _getSubtree;

/**
 * @deprecated gt-react/internal is deprecated. Use public gt-react exports instead.
 */
const getSubtreeWithCreation = _getSubtreeWithCreation;

/**
 * @deprecated gt-react/internal is deprecated. Use public gt-react exports instead.
 */
const injectEntry = _injectEntry;

/**
 * @deprecated gt-react/internal is deprecated. Use public gt-react exports instead.
 */
const isDictionaryEntry = _isDictionaryEntry;

/**
 * @deprecated gt-react/internal is deprecated. Use public gt-react exports instead.
 */
const stripMetadataFromEntries = _stripMetadataFromEntries;

/**
 * @deprecated gt-react/internal is deprecated. Use public gt-react exports instead.
 */
const injectHashes = _injectHashes;

/**
 * @deprecated gt-react/internal is deprecated. Use public gt-react exports instead.
 */
const injectTranslations = _injectTranslations;

/**
 * @deprecated gt-react/internal is deprecated. Use public gt-react exports instead.
 */
const injectFallbacks = _injectFallbacks;

/**
 * @deprecated gt-react/internal is deprecated. Use public gt-react exports instead.
 */
const injectAndMerge = _injectAndMerge;

/**
 * @deprecated gt-react/internal is deprecated. Use public gt-react exports instead.
 */
const collectUntranslatedEntries = _collectUntranslatedEntries;

/**
 * @deprecated gt-react/internal is deprecated. Use public gt-react exports instead.
 */
const msg = _msg;

/**
 * @deprecated gt-react/internal is deprecated. Use public gt-react exports instead.
 */
const decodeMsg = _decodeMsg;

/**
 * @deprecated gt-react/internal is deprecated. Use public gt-react exports instead.
 */
const decodeOptions = _decodeOptions;

/**
 * @deprecated gt-react/internal is deprecated. Use public gt-react exports instead.
 */
const derive = _derive;

/**
 * @deprecated gt-react/internal is deprecated. Use public gt-react exports instead.
 */
const declareVar = _declareVar;

/**
 * @deprecated gt-react/internal is deprecated. Use public gt-react exports instead.
 */
const decodeVars = _decodeVars;

/**
 * @deprecated gt-react/internal is deprecated. Use public gt-react exports instead.
 */
const mFallback = _mFallback;

/**
 * @deprecated gt-react/internal is deprecated. Use public gt-react exports instead.
 */
const gtFallback = _gtFallback;

/**
 * @deprecated gt-react/internal is deprecated. Use public gt-react exports instead.
 */
const getDefaultRenderSettings = _getDefaultRenderSettings;

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
  ClientProviderProps,
  GTProviderProps,
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
  GTFunctionType,
  _Message,
  _Messages,
};

export {
  defaultEnableI18nCookieName,
  defaultLocaleCookieName,
  defaultRegionCookieName,
  reactHasUse,
  Derive,
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
  msg,
  decodeMsg,
  decodeOptions,
  derive,
  declareVar,
  decodeVars,
  mFallback,
  gtFallback,
  getDefaultRenderSettings,
};
