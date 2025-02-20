import { TranslationOptions, TranslationsObject, RenderMethod } from '../../types/types';
import { TranslateContentCallback } from '../../types/runtime';
export default function useTranslateContent(translations: TranslationsObject | null, locale: string, defaultLocale: string, translationRequired: boolean, dialectTranslationRequired: boolean, runtimeTranslationEnabled: boolean, registerContentForTranslation: TranslateContentCallback, renderSettings: {
    method: RenderMethod;
    timeout?: number;
}): (content: string, options?: TranslationOptions) => string;
//# sourceMappingURL=useTranslateContent.d.ts.map