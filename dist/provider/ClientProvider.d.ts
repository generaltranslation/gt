import { ClientDictionary } from './types';
export default function ClientProvider({ children, dictionary, initialTranslations, locale, defaultLocale, translationRequired, requiredPrefix, renderSettings, projectId, devApiKey, baseUrl, ...metadata }: {
    children: any;
    dictionary: ClientDictionary;
    initialTranslations: Record<string, any>;
    locale: string;
    defaultLocale: string;
    translationRequired: boolean;
    requiredPrefix: string | undefined;
    renderSettings: {
        method: 'skeleton' | 'replace' | 'hang' | 'subtle';
        timeout: number | null;
    };
    projectId: string;
    devApiKey: string;
    baseUrl: string;
}): import("react/jsx-runtime").JSX.Element;
//# sourceMappingURL=ClientProvider.d.ts.map