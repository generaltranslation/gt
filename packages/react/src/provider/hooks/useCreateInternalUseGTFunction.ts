import { hashSource } from 'generaltranslation/id';
import { useCallback } from 'react';
import {
  InlineTranslationOptions,
  TranslationsStatus,
  Translations,
  RenderMethod,
} from '../../types/types';
import { TranslateIcuCallback } from '../../types/runtime';
import { formatMessage } from 'generaltranslation';
import { validateString } from '../helpers/validateString';
import { missingVariablesError } from '../../errors/createErrors';

export default function useCreateInternalUseGTFunction(
  translations: Translations | null,
  translationsStatus: TranslationsStatus | null,
  locale: string,
  defaultLocale: string,
  translationRequired: boolean,
  dialectTranslationRequired: boolean,
  runtimeTranslationEnabled: boolean,
  registerIcuForTranslation: TranslateIcuCallback,
  renderSettings: { method: RenderMethod }
): (string: string, options?: InlineTranslationOptions) => string {
  return useCallback(
    (contentString: string, options: InlineTranslationOptions = {}) => {
      // ----- SET UP ----- //
      const {
        $id: id,
        $context: context,
        $hash: _hash,
        ...variables
      } = options;

      // Check: reject invalid content
      if (!contentString || typeof contentString !== 'string') return '';

      // Check: reject invalid variables
      if (!validateString(contentString, variables)) {
        throw new Error(
          missingVariablesError(Object.keys(variables), contentString)
        );
      }

      // Render method
      const renderMessage = (message: string, locales: string[]) => {
        return formatMessage(message, {
          locales,
          variables,
        });
      };

      // ----- CHECK TRANSLATIONS ----- //

      // Dependency flag to avoid recalculating hash whenever translation object changes
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
          ...(context && { context }),
          ...(id && { id }),
          dataFormat: 'ICU',
        });
        if (_hash) {
          if (_hash !== hash) {
            console.error(`Mismatch: Buildtime: ${_hash} Runtime: ${hash}`);
          } else {
            console.log('hash matches!');
          }
        } else {
          console.error('no $hash');
        }
      }

      // Get translation
      const translationEntry = translationWithIdExists
        ? translations?.[id as string]
        : translations?.[hash];

      const translationStatus = translationsStatus?.[hash];

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
          ...(context && { context }),
          ...(id && { id }),
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
      translationsStatus,
      locale,
      defaultLocale,
      translationRequired,
      runtimeTranslationEnabled,
      registerIcuForTranslation,
      dialectTranslationRequired,
    ]
  );
}
