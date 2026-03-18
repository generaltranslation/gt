import { resolveTranslationSyncWithFallback } from 'gt-i18n/internal';
import { InlineTranslationOptions } from 'gt-i18n/types';
import { createTranslationFailedDueToBrowserEnvironmentWarning } from '../../../shared/messages';
import { StringOrTemplateSyncResolutionFunction } from './types';

/**
 * NOTE: t() is the only function exported from the 'gt-react' entry point.
 * All other functions in i18n-context are exported from the 'gt-react/browser' entry point.
 */

/**
 * Translate a message
 * @param {string} message - The message to translate.
 * @param {InlineTranslationOptions} [options] - The options for the translation.
 * @returns {string} The translated message.
 *
 * This is a BROWSER ONLY function.
 *
 * @example
 * t('Hello, world!'); // Translates 'Hello, world!'
 *
 * @example
 * t('Hello, {name}!', { name: 'John' }); // Translates 'Hello, John!'
 *
 * @example
 * t`Hello, ${name}` // Translate via tagged template literal
 *
 */
export const t: StringOrTemplateSyncResolutionFunction = (
  messageOrStrings: string | TemplateStringsArray,
  ...values: unknown[]
) => {
  // Trigger browser environment warning
  if (typeof window === 'undefined') {
    console.warn(
      createTranslationFailedDueToBrowserEnvironmentWarning(messageOrStrings)
    );
  }

  //  t("Hello, {name}!", { name: "John" })
  if (typeof messageOrStrings === 'string') {
    return resolveTranslationSyncWithFallback(
      messageOrStrings,
      values.at(0) as InlineTranslationOptions | undefined
    );
  }

  // t`Hello, ${name}`
  const { message, variables } = extractInterpolatableValues(
    messageOrStrings,
    values
  );
  return resolveTranslationSyncWithFallback(message, variables);
};

// ----- Helper Functions ----- //

/**
 * Given a TemplateStringsArray, and values, return the uninterpolated message and variables.
 * @param strings - The template strings.
 * @param values - The values to interpolate.
 * @returns The interpolated message and variables.
 */
function extractInterpolatableValues(
  strings: TemplateStringsArray,
  values: unknown[]
): {
  message: string;
  variables: Record<string, unknown>;
} {
  // String parts
  const parts: string[] = [];
  // Variables
  const variables: Record<string, unknown> = {};
  let varIndex = 0;

  for (let i = 0; i < strings.length; i++) {
    // Add the cooked text from the quasi (use cooked to handle escape sequences)
    parts.push(strings[i]);

    // If there's a corresponding expression, create a variable placeholder
    if (i < values.length) {
      const key = varIndex.toString();
      parts.push(`{${key}}`);
      variables[key] = values[i];
      varIndex++;
    }
  }

  return {
    message: parts.join(''),
    variables,
  };
}
