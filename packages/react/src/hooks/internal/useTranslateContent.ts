import { renderContentToString, splitStringToContent } from "generaltranslation";
import { hashJsxChildren } from "generaltranslation/id";
import { useCallback } from "react";
import { TranslationsObject } from "../../internal";

export default function useTranslateContent(
    translations: TranslationsObject | null, 
    locale: string, defaultLocale: string,
    translationRequired: boolean
) {
    return useCallback((
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

        // ----- RENDER METHOD ----- //

        const source = splitStringToContent(content); // parse content

        const renderContent = (content: any, locales: string[]) => {
          return renderContentToString(
            content,
            locales,
            options.variables,
            options.variablesOptions
          );
        };

        if (!translationRequired)
          return renderContent(source, [defaultLocale]);

        // get hash
        const hash = hashJsxChildren({
          source,
          ...(options?.context && { context: options.context }),
          ...(options?.id && { id: options.id }),
        });
    
        // ----- CHECK CACHE ----- //
        // Remember, render is blocked until after cache is checked

        const translation = translations?.[hash];
    
        // Check translation successful
        if (translation?.state === 'success') {
            return renderContent(
              translation.target,
              [locale, defaultLocale]
            );
        }
    
        // Note: in the future, we may add on demand translation for dev here
        return renderContent(source, [defaultLocale]);
        },
      [translations, locale, defaultLocale, translationRequired]
    );
}