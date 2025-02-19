import { isSameLanguage, renderContentToString, splitStringToContent } from "generaltranslation";
import getI18NConfig from "../../config-dir/getI18NConfig";
import { getLocale } from "../../server";
import { hashJsxChildren } from "generaltranslation/id";
import { createStringTranslationError } from "../../errors/createErrors";

export default async function getGT() {

    // ----- SET UP ----- //
    const I18NConfig = getI18NConfig();
    const locale = await getLocale();
    const defaultLocale = I18NConfig.getDefaultLocale();
    const translationRequired = I18NConfig.requiresTranslation(locale);
    const translations =
        translationRequired ? await I18NConfig.getCachedTranslations(locale) : undefined;

    const t = (
        content: string,
        options: {
          locale?: string;
          context?: string;
          variables?: Record<string, any>;
          variableOptions?: Record<
            string,
            Intl.NumberFormatOptions | Intl.DateTimeFormatOptions
          >;
          [key: string]: any;
        } = {}
    ) => {

        if (!content || typeof content !== 'string') return '';

        const source = splitStringToContent(content);

        const renderContent = (content: any, locales: string[]) => {
            return renderContentToString(
              content,
              locales,
              options.variables,
              options.variablesOptions
            );
        };

        if (!translationRequired) return renderContent(source, [defaultLocale]);

        const context = options?.context;
        const id = options?.id;
        const hash = hashJsxChildren({
            source,
            ...(context && { context }),
            ...(id && { id }),
        });

        if (translations?.[hash]?.state === 'success') {
            return renderContent(translations[hash].target, [locale, defaultLocale]);
        }

        // FALLBACK
        console.warn(createStringTranslationError(content, id, "t"));

        return renderContent(source, [ defaultLocale ]);
    }

    return t;
}