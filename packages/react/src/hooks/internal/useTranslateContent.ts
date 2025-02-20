import {
  renderContentToString,
  splitStringToContent,
} from 'generaltranslation';
import { hashJsxChildren } from 'generaltranslation/id';
import { useCallback } from 'react';
import { TranslationOptions, TranslationsObject } from '../../types/types';
import { TranslateContentCallback } from '../../types/runtime';

export default function useTranslateContent(
  translations: TranslationsObject | null,
  locale: string,
  defaultLocale: string,
  translationRequired: boolean,
  runtimeTranslationEnabled: boolean,
  registerContentForTranslation: TranslateContentCallback
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
      const translationEntry = translations?.[key];
      if (translationEntry?.state === 'success') {
        return renderContent(translationEntry.target, [locale, defaultLocale]);
      }

      // ----- TRANSLATE ON DEMAND ----- //
      // develoment only

      // Check if runtime translation is enabled
      if (!runtimeTranslationEnabled) {
        return renderContent(source, [defaultLocale]);
      }

      // Translate Content
      registerContentForTranslation({
        source,
        targetLocale: locale,
        metadata: {
          ...(options?.context && { context: options.context }),
          id: options?.id,
          hash: key,
        },
      });

      // Fallback to defaultLocale
      // Note: in the future, we may add on demand translation for dev here
      return renderContent(source, [defaultLocale]);
    },
    [
      translations,
      locale,
      defaultLocale,
      translationRequired,
      runtimeTranslationEnabled,
      registerContentForTranslation,
    ]
  );
}
