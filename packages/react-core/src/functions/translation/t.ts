import {
  createLookupOptions,
  getRuntimeEnvironment,
  interpolateMessage,
} from 'gt-i18n/internal';
import type { GTTranslationOptions } from 'gt-i18n/types';
import type { LookupOptionsFor } from 'gt-i18n/internal/types';
import { getI18nConfig } from '../../setup/i18nConfig';
import {
  getReadonlyConditionStore,
  isReadonlyConditionStoreInitialized,
} from '../../condition-store/singleton-operations';
import { StringContent, StringFormat } from 'generaltranslation/types';
import { getReactI18nCacheInstance } from '../../i18n-cache/singleton-operations';
import { getShouldTranslate } from '../../hooks/utils/getShouldTranslate';
import { createDiagnosticMessage } from 'generaltranslation/internal';

/**
 * Translate a message
 * @param {string} message - The message to translate.
 * @param {GTTranslationOptions} [options] - The options for the translation.
 * @returns {string} The translated message.
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
  // Warnings and errors
  enforceSSRRules(messageOrStrings);

  //  t("Hello, {name}!", { name: "John" })
  if (typeof messageOrStrings === 'string') {
    const options = values.at(0) as GTTranslationOptions | undefined;
    const locale = options?.$locale ?? getLocale();
    return resolveStringContent(
      locale,
      messageOrStrings,
      createLookupOptions(locale, options ?? {}, 'ICU')
    );
  }

  // t`Hello, ${name}`
  return handleTaggedTemplateLiteralTranslation(messageOrStrings, values);
};

// ----- Helper Functions ----- //

export function resolveStringContent(
  locale: string,
  content: StringContent,
  options: LookupOptionsFor<StringFormat> = {}
): StringContent {
  const cache = getReactI18nCacheInstance();
  const defaultLocale = getI18nConfig().getDefaultLocale();
  if (!getShouldTranslate()) {
    return interpolateMessage({
      options,
      source: content,
      sourceLocale: defaultLocale,
    });
  }

  const lookupOptions = createLookupOptions(locale, options, 'ICU');
  const translation = cache.lookupTranslation(
    lookupOptions.$locale,
    content,
    lookupOptions
  );
  return interpolateMessage({
    source: content,
    target: translation,
    options: lookupOptions,
    sourceLocale: defaultLocale,
  });
}

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
  const locale = getLocale();
  // for tagged template literals, there has been no compiler transformation
  // (1) lookup interpolated template (aka derived message)
  const interpolatedTemplate = interpolateTemplateLiteral(
    messageOrStrings,
    values
  );
  const cache = getReactI18nCacheInstance();
  const translatedInterpolatedTemplate = cache.lookupTranslation(
    locale,
    interpolatedTemplate,
    { $format: 'STRING' }
  );
  if (translatedInterpolatedTemplate) return translatedInterpolatedTemplate;

  // (2) resolve uninterpolated message
  const { message, variables } = extractInterpolatableValues(
    messageOrStrings,
    values
  );
  return resolveStringContent(locale, message, variables);
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

/**
 * Module-level t() only works for SPA.
 * We have to error or fallback in SSR.
 */
function enforceSSRRules(messageOrStrings: string | TemplateStringsArray) {
  const ssrEnabled = getI18nConfig().getRenderStrategy() === 'server-render';
  const moduleLevel = !isReadonlyConditionStoreInitialized();
  if (!ssrEnabled || !moduleLevel) return;

  const message =
    typeof messageOrStrings === 'string'
      ? messageOrStrings
      : messageOrStrings.join('');
  const runtimeEnvironment = getRuntimeEnvironment();
  const errorMessage = createDiagnosticMessage({
    source: '@generaltranslation/react-core',
    severity: 'Error',
    whatHappened:
      'Using the t() function at the module level is forbidden in server-rendered applications.',
    fix: 'Either move the t() invocation into a request-time scope or register the string with the msg() function and translate with an m() function. Ensure that you have added the <GTProvider> at the root of your component tree.',
    wayOut:
      runtimeEnvironment === 'development'
        ? undefined
        : 'Falling back to defaultLocale value.',
    details: `Message: "${message}"`,
  });
  if (getRuntimeEnvironment() === 'development') {
    throw new Error(errorMessage);
  } else {
    console.error(errorMessage);
  }
}

function getLocale(): string {
  return getReadonlyConditionStore().getLocale();
}

/**
 * Overloaded type for the `t` function.
 * - Tagged template: t`Hello, ${name}` (transformed by the compiler plugin at build time)
 * - Function call: t("Hello, {name}", { name: "John" })
 */
interface StringOrTemplateSyncResolutionFunction {
  (strings: TemplateStringsArray, ...values: unknown[]): string;
  (message: string, options?: GTTranslationOptions): string;
}
