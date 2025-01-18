import { Dictionary, RenderMethod } from 'gt-react/internal';
import { Translations } from '../types/types';
export default function ClientProvider({ children, dictionary, initialTranslations, locale, defaultLocale, translationRequired, regionalTranslationRequired, requiredPrefix, renderSettings, projectId, devApiKey, runtimeUrl }: {
    children: any;
    dictionary: Dictionary;
    initialTranslations: Translations;
    locale: string;
    defaultLocale: string;
    translationRequired: boolean;
    regionalTranslationRequired: boolean;
    requiredPrefix: string | undefined;
    renderSettings: {
        method: RenderMethod;
        timeout?: number;
    };
    projectId?: string;
    devApiKey?: string;
    runtimeUrl?: string;
}): import("react/jsx-runtime").JSX.Element;
//# sourceMappingURL=ClientProvider.d.ts.map