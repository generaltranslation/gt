import {
  renderContentToString,
  splitStringToContent,
} from 'generaltranslation';
import { hashJsxChildren } from 'generaltranslation/id';
import { useCallback } from 'react';
import { TranslationOptions, TranslationsObject } from '../../types/types';

export default function useTranslateContent(
  translations: TranslationsObject | null,
  locale: string,
  defaultLocale: string,
  translationRequired: boolean
): (content: string, options?: TranslationOptions) => string {
  return useCallback(
    (
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
      // ----- SET UP ----- //

      // Check: reject invalid content
      if (!content || typeof content !== 'string') return '';

      // Parse content
      const source = splitStringToContent(content);

      // Render method
      const renderContent = (content: any, locales: string[]) => {
        return renderContentToString(
          content,
          locales,
          options.variables,
          options.variablesOptions
        );
      };

      // Check: translation not required
      if (!translationRequired) return renderContent(source, [defaultLocale]);

      // ----- CHECK TRANSLATIONS ----- //

      // Get key
      const key = hashJsxChildren({
        source,
        ...(options?.context && { context: options.context }),
        ...(options?.id && { id: options.id }),
      });

      // Check translation successful
      const translation = translations?.[key];
      if (translation?.state === 'success') {
        return renderContent(translation.target, [locale, defaultLocale]);
      }

      // Fallback to defaultLocale
      // Note: in the future, we may add on demand translation for dev here
      return renderContent(source, [defaultLocale]);
    },
    [translations, locale, defaultLocale, translationRequired]
  );
}
