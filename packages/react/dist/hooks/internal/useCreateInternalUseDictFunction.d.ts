import { Dictionary, DictionaryTranslationOptions, MessagesObject, RenderMethod, TranslationsObject } from '../../types/types';
import { TranslateContentCallback } from '../../types/runtime';
export default function useCreateInternalUseDictFunction(dictionary: Dictionary | undefined, translations: TranslationsObject | null, messages: MessagesObject | null, locale: string, defaultLocale: string, translationRequired: boolean, dialectTranslationRequired: boolean, runtimeTranslationEnabled: boolean, registerContentForTranslation: TranslateContentCallback, renderSettings: {
    method: RenderMethod;
}): (id: string, options?: DictionaryTranslationOptions) => string;
//# sourceMappingURL=useCreateInternalUseDictFunction.d.ts.map