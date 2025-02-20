import { TranslationOptions, TranslationsObject } from '../../types/types';
import { TranslateContentCallback } from '../../types/runtime';
export default function useTranslateContent(translations: TranslationsObject | null, locale: string, defaultLocale: string, translationRequired: boolean, runtimeTranslationEnabled: boolean, registerContentForTranslation: TranslateContentCallback): (content: string, options?: TranslationOptions) => string;
//# sourceMappingURL=useTranslateContent.d.ts.map