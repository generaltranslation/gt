import { hashSource } from 'generaltranslation/id';
import { useCallback } from 'react';
import {
  InlineTranslationOptions,
  Translations,
  RenderMethod,
} from '../../types/types';
import { TranslateIcuCallback } from '../../types/runtime';
import { formatMessage } from 'generaltranslation';
import { validateString } from '../helpers/validateString';
import { missingVariablesError } from '../../errors/createErrors';

export default function useCreateInternalUseGTFunction(
  translations: Translations | null,
  locale: string,
  defaultLocale: string,
  translationRequired: boolean,
  dialectTranslationRequired: boolean,
  runtimeTranslationEnabled: boolean,
  registerIcuForTranslation: TranslateIcuCallback,
  renderSettings: { method: RenderMethod }
): (message: string, options?: InlineTranslationOptions) => string {
  return useCallback(
    (message: string, options: InlineTranslationOptions = {}) => {
      // ----- SET UP ----- //
      const {
        $id: id,
        $context: context,
        $_hash: _hash,
        ...variables
      } = options;

      // Check: reject invalid content
      if (!message || typeof message !== 'string') return '';

      // Check: reject invalid variables
      if (!validateString(message, variables)) {
        throw new Error(missingVariablesError(Object.keys(variables), message));
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
          source: message,
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

      // ----- TRANSLATE ON DEMAND ----- //

      // Render fallback when tx not required or error
      if (!translationRequired || translationEntry === null) {
        return renderMessage(message, [defaultLocale]);
      }

      // Render success
      if (translationEntry) {
        return renderMessage(translationEntry as string, [
          locale,
          defaultLocale,
        ]);
      }

      // ----- TRANSLATE ON DEMAND ----- //
      // development only

      // Check if runtime translation is enabled
      if (!runtimeTranslationEnabled) {
        return renderMessage(message, [defaultLocale]);
      }

      // Translate Content
      registerIcuForTranslation({
        source: message,
        targetLocale: locale,
        metadata: {
          ...(context && { context }),
          ...(id && { id }),
          hash: hash || '',
        },
      });

      // renderSettings.method must be ignored because t() is synchronous &
      // t() should never return an empty string because functions reason about strings based on falsiness
      return renderMessage(message, [defaultLocale]);
    },
    [
      translations,
      locale,
      defaultLocale,
      translationRequired,
      runtimeTranslationEnabled,
      registerIcuForTranslation,
      dialectTranslationRequired,
    ]
  );
}
