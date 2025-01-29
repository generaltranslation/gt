import React from 'react';
import { FlattenedTaggedDictionary, RenderMethod, TranslatedChildren, TranslationsObject } from '../types/types';
export default function ClientProvider({ children, dictionary, initialTranslations, translationPromises, locale, defaultLocale, translationRequired, dialectTranslationRequired, locales, requiredPrefix, renderSettings, projectId, devApiKey, runtimeUrl, runtimeTranslations, }: {
    children: any;
    dictionary: FlattenedTaggedDictionary;
    initialTranslations: TranslationsObject;
    translationPromises: Record<string, Promise<TranslatedChildren>>;
    locale: string;
    locales: string[];
    defaultLocale: string;
    translationRequired: boolean;
    dialectTranslationRequired: boolean;
    requiredPrefix: string | undefined;
    renderSettings: {
        method: RenderMethod;
        timeout?: number;
    };
    projectId?: string;
    devApiKey?: string;
    runtimeUrl?: string;
    runtimeTranslations?: boolean;
}): React.JSX.Element;
//# sourceMappingURL=ClientProvider.d.ts.map