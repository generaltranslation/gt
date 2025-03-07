import flattenDictionary from './internal/flattenDictionary';
import addGTIdentifier from './internal/addGTIdentifier';
import writeChildrenAsObjects from './internal/writeChildrenAsObjects';
import getPluralBranch from './branches/plurals/getPluralBranch';
import getDictionaryEntry, { isValidDictionaryEntry } from './provider/helpers/getDictionaryEntry';
import getEntryAndMetadata from './provider/helpers/getEntryAndMetadata';
import getVariableProps from './variables/_getVariableProps';
import isVariableObject from './provider/helpers/isVariableObject';
import getVariableName, { getFallbackVariableName } from './variables/getVariableName';
import renderDefaultChildren from './provider/rendering/renderDefaultChildren';
import renderTranslatedChildren from './provider/rendering/renderTranslatedChildren';
import { defaultRenderSettings } from './provider/rendering/defaultRenderSettings';
import renderSkeleton from './provider/rendering/renderSkeleton';
import { Dictionary, RenderMethod, TranslatedChildren, TranslatedContent, TranslationError, TranslationsObject, DictionaryEntry, TranslationSuccess, TranslationLoading, Children, FlattenedDictionary, Metadata, Child, GTProp, Entry, GTTranslationError, DictionaryTranslationOptions, InlineTranslationOptions, RuntimeTranslationOptions, LocalesMessages, MessagesContent, MessagesObject, CustomLoader } from './types/types';
import { GTContextType, ClientProviderProps } from './types/providers';
export { addGTIdentifier, writeChildrenAsObjects, isVariableObject, Dictionary, flattenDictionary, getDictionaryEntry, isValidDictionaryEntry, getVariableProps, DictionaryEntry, FlattenedDictionary, GTTranslationError, Metadata, getPluralBranch, getEntryAndMetadata, getVariableName, getFallbackVariableName, renderDefaultChildren, renderTranslatedChildren, renderSkeleton, RenderMethod, defaultRenderSettings, Children, Child, GTProp, Entry, TranslatedChildren, TranslatedContent, TranslationsObject, TranslationLoading, TranslationError, TranslationSuccess, GTContextType, ClientProviderProps, DictionaryTranslationOptions, InlineTranslationOptions, RuntimeTranslationOptions, MessagesContent, MessagesObject, LocalesMessages, CustomLoader, };
//# sourceMappingURL=internal.d.ts.map