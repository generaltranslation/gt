import {
  resolveTranslationSync,
  resolveTranslationSyncWithFallback,
} from 'gt-i18n/internal';
import type { InlineTranslationOptions } from 'gt-i18n/types';
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
  return handleTaggedTemplateLiteralTranslation(messageOrStrings, values);
};

// ----- Helper Functions ----- //

/**
 * Handle tagged template literal translation
 * @param messageOrStrings - The message or strings to translate.
 * @param values - The values to interpolate.
 * @returns The translated message.
 *
 * This is triggered when there has been no compiler transformation
 *
 * Try looking up interpolated template first
 * If not found, resolve uninterpolated message
 */
function handleTaggedTemplateLiteralTranslation(
  messageOrStrings: TemplateStringsArray,
  values: unknown[]
): string {
  // for tagged template literals, there has been no compiler transformation
  // (1) lookup interpolated template (aka derived message)
  const interpolatedTemplate = interpolateTemplateLiteral(
    messageOrStrings,
    values
  );
  const translatedInterpolatedTemplate =
    resolveTranslationSync(interpolatedTemplate);
  if (translatedInterpolatedTemplate) return translatedInterpolatedTemplate;

  // (2) resolve uninterpolated message
  const { message, variables } = extractInterpolatableValues(
    messageOrStrings,
    values
  );
  return resolveTranslationSyncWithFallback(message, variables);
}

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

/**
 * Interpolate a template literal
 * @param message - The message to interpolate.
 * @param variables - The variables to interpolate.
 * @returns The interpolated message.
 */
function interpolateTemplateLiteral(
  strings: TemplateStringsArray,
  values: unknown[]
): string {
  return strings
    .map((string, index) => {
      return string + (values[index] ?? '');
    })
    .join('');
}
