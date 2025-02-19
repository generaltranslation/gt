import { TranslationsObject } from "../../internal";
export default function useTranslateContent(translations: TranslationsObject | null, locale: string, defaultLocale: string, translationRequired: boolean): (content: string, options?: {
    locale?: string;
    context?: string;
    variables?: Record<string, any>;
    variableOptions?: Record<string, Intl.NumberFormatOptions | Intl.DateTimeFormatOptions>;
    [key: string]: any;
}) => string;
//# sourceMappingURL=useTranslateContent.d.ts.map