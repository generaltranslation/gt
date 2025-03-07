import { Dictionary, DictionaryTranslationOptions, RenderMethod, TranslationsObject } from '../../types/types';
import { TranslateContentCallback } from '../../types/runtime';
export default function useCreateInternalUseDictFunction(dictionary: Dictionary, translations: TranslationsObject | null, locale: string, defaultLocale: string, translationRequired: boolean, dialectTranslationRequired: boolean, runtimeTranslationEnabled: boolean, registerContentForTranslation: TranslateContentCallback, renderSettings: {
    method: RenderMethod;
}): (id: string, options?: DictionaryTranslationOptions) => string;
//# sourceMappingURL=useCreateInternalUseDictFunction.d.ts.map