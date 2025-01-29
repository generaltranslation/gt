import flattenDictionary from "./internal/flattenDictionary";
import addGTIdentifier from "./internal/addGTIdentifier";
import writeChildrenAsObjects from "./internal/writeChildrenAsObjects";
import getPluralBranch from "./branches/plurals/getPluralBranch";
import getDictionaryEntry from "./provider/helpers/getDictionaryEntry";
import extractEntryMetadata from "./provider/helpers/extractEntryMetadata";
import getVariableProps from "./variables/_getVariableProps";
import isVariableObject from "./provider/helpers/isVariableObject";
import getVariableName, {
  getFallbackVariableName,
} from "./variables/getVariableName";
import renderDefaultChildren from "./provider/rendering/renderDefaultChildren";
import renderTranslatedChildren from "./provider/rendering/renderTranslatedChildren";
import { defaultRenderSettings } from "./provider/rendering/defaultRenderSettings";
import renderSkeleton from "./provider/rendering/renderSkeleton";
import {
  Dictionary,
  RenderMethod,
  TranslatedChildren,
  TranslatedContent,
  TranslationError,
  TranslationsObject,
  DictionaryEntry,
  TranslationSuccess,
  GTContextType,
  TranslationLoading,
  TaggedChildren,
  Children,
  FlattenedDictionary,
  Metadata,
  Child,
  GTProp,
  Entry,
} from "./types/types";
import renderVariable from "./provider/rendering/renderVariable";
import { isEmptyReactFragment } from "./utils/utils";
export {
  addGTIdentifier,
  writeChildrenAsObjects,
  isVariableObject,
  isEmptyReactFragment,
  Dictionary,
  flattenDictionary,
  getDictionaryEntry,
  getVariableProps,
  DictionaryEntry,
  FlattenedDictionary,
  Metadata,
  getPluralBranch,
  extractEntryMetadata,
  getVariableName,
  getFallbackVariableName,
  renderVariable,
  renderDefaultChildren,
  renderTranslatedChildren,
  renderSkeleton,
  RenderMethod,
  defaultRenderSettings,
  TaggedChildren,
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
};
