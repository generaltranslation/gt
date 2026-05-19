// No useContext related exports should go through here!

import flattenDictionary from "./deprecated/internal/flattenDictionary";
import addGTIdentifier from "./deprecated/internal/addGTIdentifier";
import { removeInjectedT } from "./deprecated/internal/removeInjectedT";
import writeChildrenAsObjects from "./deprecated/internal/writeChildrenAsObjects";
import getPluralBranch from "./deprecated/branches/plurals/getPluralBranch";
import {
  getDictionaryEntry,
  isValidDictionaryEntry,
} from "./deprecated/dictionaries/getDictionaryEntry";
import getEntryAndMetadata from "./deprecated/dictionaries/getEntryAndMetadata";
import getVariableProps from "./deprecated/variables/_getVariableProps";
import isVariableObject from "./deprecated/rendering/isVariableObject";
import getVariableName from "./deprecated/variables/getVariableName";
import renderDefaultChildren from "./deprecated/rendering/renderDefaultChildren";
import renderTranslatedChildren from "./deprecated/rendering/renderTranslatedChildren";
import { getDefaultRenderSettings } from "./deprecated/rendering/getDefaultRenderSettings";
import renderSkeleton from "./deprecated/rendering/renderSkeleton";
import {
  defaultLocaleCookieName,
  defaultRegionCookieName,
  defaultEnableI18nCookieName,
} from "./deprecated/utils/cookies";
import mergeDictionaries from "./deprecated/dictionaries/mergeDictionaries";
import { reactHasUse } from "./deprecated/promises/reactHasUse";
import {
  getSubtree,
  getSubtreeWithCreation,
} from "./deprecated/dictionaries/getSubtree";
import { injectEntry } from "./deprecated/dictionaries/injectEntry";
import { isDictionaryEntry } from "./deprecated/dictionaries/isDictionaryEntry";
import { stripMetadataFromEntries } from "./deprecated/dictionaries/stripMetadataFromEntries";
import { injectHashes } from "./deprecated/dictionaries/injectHashes";
import { injectTranslations } from "./deprecated/dictionaries/injectTranslations";
import { injectFallbacks } from "./deprecated/dictionaries/injectFallbacks";
import { injectAndMerge } from "./deprecated/dictionaries/injectAndMerge";
import { collectUntranslatedEntries } from "./deprecated/dictionaries/collectUntranslatedEntries";
import { msg, decodeMsg, decodeOptions } from "./deprecated/messages/messages";
import { Derive } from "./deprecated/variables/Derive";

export * from "gt-i18n/fallbacks";
export { derive, declareVar, decodeVars } from "gt-i18n";

export {
  addGTIdentifier,
  removeInjectedT,
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
  defaultEnableI18nCookieName,
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
  Derive,
};
