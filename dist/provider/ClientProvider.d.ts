import { ClientDictionary, ClientTranslations } from './types';
export default function ClientProvider({ children, dictionary, translations, locale, defaultLocale, translationRequired, requiredPrefix, }: {
    children: any;
    dictionary: ClientDictionary;
    translations: ClientTranslations;
    locale: string;
    defaultLocale: string;
    translationRequired: boolean;
    requiredPrefix: string | undefined;
}): import("react/jsx-runtime").JSX.Element;
//# sourceMappingURL=ClientProvider.d.ts.map