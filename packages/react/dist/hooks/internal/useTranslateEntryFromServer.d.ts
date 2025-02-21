import { Dictionary, TranslationsObject } from '../../types/types';
import React from 'react';
export default function useTranslateEntryFromServer({ dictionary, translations, locale, renderSettings, runtimeTranslationEnabled, translationRequired, dialectTranslationRequired, locales, defaultLocale, }: {
    dictionary: Dictionary;
    translations: TranslationsObject | null;
    locale: string;
    translationRequired: boolean;
    defaultLocale: string;
    locales: string[];
    renderSettings: {
        method: string;
        timeout?: number;
    };
    runtimeTranslationEnabled: boolean;
    dialectTranslationRequired: boolean;
}): (id: string, options?: Record<string, any>) => React.ReactNode | string | undefined;
//# sourceMappingURL=useTranslateEntryFromServer.d.ts.map