// No useContext related exports should go through here!

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
import { getDefaultRenderSettings } from './rendering/getDefaultRenderSettings';
import renderSkeleton from './rendering/renderSkeleton';
import {
  defaultLocaleCookieName,
  defaultRegionCookieName,
} from './utils/cookies';
import mergeDictionaries from './dictionaries/mergeDictionaries';
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
import { msg, decodeMsg, decodeOptions } from './messages/messages';

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
  getDefaultRenderSettings,
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
  msg,
  decodeMsg,
  decodeOptions,
};
