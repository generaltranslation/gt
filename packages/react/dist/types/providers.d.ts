import { TranslationsObject, RenderMethod, InlineTranslationOptions, DictionaryTranslationOptions, Dictionary, MessagesObject } from './types';
import { TranslateContentCallback, TranslateChildrenCallback } from './runtime';
export type GTContextType = {
    registerContentForTranslation: TranslateContentCallback;
    registerJsxForTranslation: TranslateChildrenCallback;
    _internalUseGTFunction: (string: string, options?: InlineTranslationOptions) => string;
    _internalUseDictFunction: (id: string, options?: DictionaryTranslationOptions) => string;
    runtimeTranslationEnabled: boolean;
    locale: string;
    locales: string[];
    setLocale: (locale: string) => void;
    defaultLocale: string;
    translations: TranslationsObject | null;
    messages: MessagesObject | null;
    translationRequired: boolean;
    dialectTranslationRequired: boolean;
    renderSettings: {
        method: RenderMethod;
        timeout?: number;
    };
    projectId?: string;
};
export type ClientProviderProps = {
    children: any;
    dictionary: Dictionary;
    initialTranslations: TranslationsObject;
    messages: MessagesObject;
    locale: string;
    locales: string[];
    _versionId?: string;
    dictionaryEnabled?: boolean;
    defaultLocale: string;
    translationRequired: boolean;
    dialectTranslationRequired: boolean;
    renderSettings: {
        method: RenderMethod;
        timeout?: number;
    };
    runtimeTranslationEnabled: boolean;
    projectId?: string;
    devApiKey?: string;
    runtimeUrl?: string | null;
    onLocaleChange?: () => void;
    cookieName?: string;
};
//# sourceMappingURL=providers.d.ts.map