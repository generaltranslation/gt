import flattenDictionary from './internal/flattenDictionary';
import addGTIdentifier from './internal/addGTIdentifier';
import writeChildrenAsObjects from './internal/writeChildrenAsObjects';
import getPluralBranch from './branches/plurals/getPluralBranch';
import getDictionaryEntry from './provider/helpers/getDictionaryEntry';
import getEntryAndMetadata from './provider/helpers/getEntryAndMetadata';
import getVariableProps from './variables/_getVariableProps';
import isVariableObject from './provider/helpers/isVariableObject';
import getVariableName, { getFallbackVariableName } from './variables/getVariableName';
import renderDefaultChildren from './provider/rendering/renderDefaultChildren';
import renderTranslatedChildren from './provider/rendering/renderTranslatedChildren';
import { defaultRenderSettings } from './provider/rendering/defaultRenderSettings';
import renderSkeleton from './provider/rendering/renderSkeleton';
import { Dictionary, RenderMethod, TranslatedChildren, TranslatedContent, TranslationError, TranslationsObject, DictionaryEntry, TranslationSuccess, TranslationLoading, TaggedChildren, Children, FlattenedDictionary, Metadata, Child, GTProp, Entry, FlattenedTaggedDictionary, GTTranslationError, TaggedDictionary, TaggedDictionaryEntry, TaggedEntry, TranslationOptions } from './types/types';
import { GTContextType, ClientProviderProps } from './types/providers';
export { addGTIdentifier, writeChildrenAsObjects, isVariableObject, Dictionary, flattenDictionary, getDictionaryEntry, getVariableProps, DictionaryEntry, FlattenedDictionary, FlattenedTaggedDictionary, GTTranslationError, TaggedEntry, TaggedDictionaryEntry, TaggedDictionary, Metadata, getPluralBranch, getEntryAndMetadata, getVariableName, getFallbackVariableName, renderDefaultChildren, renderTranslatedChildren, renderSkeleton, RenderMethod, defaultRenderSettings, TaggedChildren, Children, Child, GTProp, Entry, TranslatedChildren, TranslatedContent, TranslationsObject, TranslationLoading, TranslationError, TranslationSuccess, GTContextType, ClientProviderProps, TranslationOptions, };
//# sourceMappingURL=internal.d.ts.map