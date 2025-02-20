import { FlattenedContentDictionary, FlattenedDictionary, TranslationsObject } from '../../types/types';
export default function useTranslateEntry({ dictionary, translations, translationRequired, locale, defaultLocale, flattenedDictionary, flattenedDictionaryContentEntries, locales, }: {
    dictionary: any;
    translations: TranslationsObject | null;
    translationRequired: boolean;
    locale: string;
    defaultLocale: string;
    flattenedDictionary: FlattenedDictionary;
    flattenedDictionaryContentEntries: FlattenedContentDictionary;
    locales: string[];
}): (id: string, options?: Record<string, any>) => React.ReactNode;
//# sourceMappingURL=useTranslateEntry.d.ts.map