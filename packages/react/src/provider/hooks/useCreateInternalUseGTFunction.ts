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

      // ----- CHECK TRANSLATIONS ----- //

      // Dependency flag to avoid recalculating hash whenever translation object changes
      const id = options?.id;
      const translationWithIdExists = id && translations?.[id as string];

      let hash = '';

      // Skip hashing:
      if (
        translationRequired && // Translation is required
        !translationWithIdExists // Translation doesn't exist under the id
      ) {
        // Calculate hash
        hash = hashJsxChildren({
          source,
          ...(options?.context && { context: options.context }),
          ...(id && { id }),
          dataFormat: 'JSX',
        });
      }

      // Get translation
      const translationEntry = translationWithIdExists
        ? translations?.[id as string]
        : translations?.[hash];

      // ----- TRANSLATE ON DEMAND ----- //

      // Render fallback when tx not required or error
      if (!translationRequired || translationEntry?.state === 'error') {
        return renderContent(source, [defaultLocale]);
      }

      // Render success
      if (translationEntry?.state === 'success') {
        return renderContent(translationEntry.target as Content, [
          locale,
          defaultLocale,
        ]);
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
          id,
          hash: hash || '',
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
