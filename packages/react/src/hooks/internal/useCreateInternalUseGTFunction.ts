import {
  renderContentToString,
  splitStringToContent,
} from 'generaltranslation';
import { hashJsxChildren } from 'generaltranslation/id';
import { useCallback } from 'react';
import {
  InlineTranslationOptions,
  TranslationsObject,
  RenderMethod,
} from '../../types/types';
import { TranslateContentCallback } from '../../types/runtime';
import { Content } from 'generaltranslation/internal';

export default function useCreateInternalUseGTFunction(
  translations: TranslationsObject | null,
  locale: string,
  defaultLocale: string,
  translationRequired: boolean,
  dialectTranslationRequired: boolean,
  runtimeTranslationEnabled: boolean,
  registerContentForTranslation: TranslateContentCallback,
  renderSettings: { method: RenderMethod }
): (string: string, options?: InlineTranslationOptions) => string {
  return useCallback(
    (
      contentString: string,
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
      if (!contentString || typeof contentString !== 'string') return '';

      // Parse content
      const source = splitStringToContent(contentString);

      // Render method
      const renderContent = (content: Content, locales: string[]) => {
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

      // Get hash
      const hash = hashJsxChildren({
        source,
        ...(options?.context && { context: options.context }),
        ...(options?.id && { id: options.id }),
        dataFormat: 'JSX',
      });

      // Check translation successful
      const translationEntry = translations?.[hash];

      if (translationEntry?.state === 'success') {
        return renderContent(translationEntry.target as Content, [
          locale,
          defaultLocale,
        ]);
      }

      if (translationEntry?.state === 'error') {
        return renderContent(source, [defaultLocale]);
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
          hash: hash,
        },
      });

      // Loading behavior
      if (renderSettings.method === 'replace') {
        return renderContent(source, [defaultLocale]);
      } else if (renderSettings.method === 'skeleton') {
        return '';
      }
      return dialectTranslationRequired // default behavior
        ? renderContent(source, [defaultLocale])
        : '';
    },
    [
      translations,
      locale,
      defaultLocale,
      translationRequired,
      runtimeTranslationEnabled,
      registerContentForTranslation,
      dialectTranslationRequired,
    ]
  );
}
