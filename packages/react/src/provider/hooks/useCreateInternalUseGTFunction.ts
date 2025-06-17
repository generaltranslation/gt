import { hashSource } from 'generaltranslation/id';
import { useCallback } from 'react';
import {
  InlineTranslationOptions,
  TranslationResultStatus,
  Translations,
  RenderMethod,
} from '../../types/types';
import { TranslateIcuCallback } from '../../types/runtime';
import { formatMessage } from 'generaltranslation';

export default function useCreateInternalUseGTFunction(
  translations: Translations | null,
  translationResultStatus: TranslationResultStatus | null,
  locale: string,
  defaultLocale: string,
  translationRequired: boolean,
  dialectTranslationRequired: boolean,
  runtimeTranslationEnabled: boolean,
  registerIcuForTranslation: TranslateIcuCallback,
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

      // Render method
      const renderMessage = (message: string, locales: string[]) => {
        return formatMessage(message, {
          locales,
          variables: options.variables,
        });
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
        hash = hashSource({
          source: contentString,
          ...(options?.context && { context: options.context }),
          ...(id && { id }),
          dataFormat: 'ICU',
        });
      }

      // Get translation
      const translationEntry = translationWithIdExists
        ? translations?.[id as string]
        : translations?.[hash];

      const translationStatus = translationResultStatus?.[hash];

      // ----- TRANSLATE ON DEMAND ----- //

      // Render fallback when tx not required or error
      if (!translationRequired || translationStatus?.status === 'error') {
        return renderMessage(contentString, [defaultLocale]);
      }

      // Render success
      if (translationStatus?.status === 'success') {
        return renderMessage(translationEntry as string, [
          locale,
          defaultLocale,
        ]);
      }

      // ----- TRANSLATE ON DEMAND ----- //
      // development only

      // Check if runtime translation is enabled
      if (!runtimeTranslationEnabled) {
        return renderMessage(contentString, [defaultLocale]);
      }

      // Translate Content
      registerIcuForTranslation({
        source: contentString,
        targetLocale: locale,
        metadata: {
          ...(options?.context && { context: options.context }),
          id,
          hash: hash || '',
        },
      });

      // Loading behavior
      if (renderSettings.method === 'replace') {
        return renderMessage(contentString, [defaultLocale]);
      } else if (renderSettings.method === 'skeleton') {
        return '';
      }
      return dialectTranslationRequired // default behavior
        ? renderMessage(contentString, [defaultLocale])
        : '';
    },
    [
      translations,
      translationResultStatus,
      locale,
      defaultLocale,
      translationRequired,
      runtimeTranslationEnabled,
      registerIcuForTranslation,
      dialectTranslationRequired,
    ]
  );
}
