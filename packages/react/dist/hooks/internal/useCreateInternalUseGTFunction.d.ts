import { InlineTranslationOptions, TranslationsObject, RenderMethod } from '../../types/types';
import { TranslateContentCallback } from '../../types/runtime';
export default function useCreateInternalUseGTFunction(translations: TranslationsObject | null, locale: string, defaultLocale: string, translationRequired: boolean, dialectTranslationRequired: boolean, runtimeTranslationEnabled: boolean, registerContentForTranslation: TranslateContentCallback, renderSettings: {
    method: RenderMethod;
}): (string: string, options?: InlineTranslationOptions) => string;
//# sourceMappingURL=useCreateInternalUseGTFunction.d.ts.map