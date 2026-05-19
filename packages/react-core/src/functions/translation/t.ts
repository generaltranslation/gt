import {
  createLookupOptions,
  getRuntimeEnvironment,
  interpolateMessage,
} from "gt-i18n/internal";
import type {
  InlineTranslationOptions,
  ResolutionOptions,
} from "gt-i18n/types";
import { getRenderStrategy } from "../../setup/globals";
import { isWritableConditionStoreInitialized } from "../../condition-store/singleton-operations";
import { StringContent, StringFormat } from "generaltranslation/types";
import { getReactI18nManager } from "../../i18n-manager/singleton-operations";
import { getShouldTranslate } from "../../hooks/utils";
import { getLocale } from "../../hooks/context-hooks";

/**
 * Translate a message
 * @param {string} message - The message to translate.
 * @param {InlineTranslationOptions} [options] - The options for the translation.
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
  if (typeof messageOrStrings === "string") {
    const options = values.at(0) as InlineTranslationOptions | undefined;
    const locale = options?.$locale ?? getLocale();
    return resolveStringContent(locale, messageOrStrings, options);
  }

  // t`Hello, ${name}`
  return handleTaggedTemplateLiteralTranslation(messageOrStrings, values);
};

// ----- Helper Functions ----- //

export function resolveStringContent(
  locale: string,
  content: StringContent,
  options: ResolutionOptions<StringFormat> = {},
): StringContent {
  const i18nManager = getReactI18nManager();
  const defaultLocale = i18nManager.getDefaultLocale();
  if (!getShouldTranslate()) {
    return interpolateMessage({
      options,
      source: content,
      sourceLocale: defaultLocale,
    });
  }

  const lookupOptions = createLookupOptions(locale, options, "ICU");
  const translation = i18nManager.lookupTranslation(
    lookupOptions.$locale,
    content,
    lookupOptions,
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
  values: unknown[],
): string {
  const locale = getLocale();
  // for tagged template literals, there has been no compiler transformation
  // (1) lookup interpolated template (aka derived message)
  const interpolatedTemplate = interpolateTemplateLiteral(
    messageOrStrings,
    values,
  );
  const i18nManager = getReactI18nManager();
  const translatedInterpolatedTemplate = i18nManager.lookupTranslation(
    locale,
    interpolatedTemplate,
    { $format: "STRING" },
  );
  if (translatedInterpolatedTemplate) return translatedInterpolatedTemplate;

  // (2) resolve uninterpolated message
  const { message, variables } = extractInterpolatableValues(
    messageOrStrings,
    values,
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
  values: unknown[],
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
    message: parts.join(""),
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
  values: unknown[],
): string {
  return strings
    .map((string, index) => {
      return string + (values[index] ?? "");
    })
    .join("");
}

/**
 * If detect SSR + module level:
 * - Build: Error
 * - Dev: Error
 * - Prod: Warn
 */
function enforceSSRRules(messageOrStrings: string | TemplateStringsArray) {
  const ssrEnabled = getRenderStrategy() === "server-render";
  const moduleLevel = !isWritableConditionStoreInitialized();
  if (!ssrEnabled || !moduleLevel) return;

  const message =
    typeof messageOrStrings === "string"
      ? messageOrStrings
      : messageOrStrings.join("");
  const errorMessage = createSSRRulesError(message);
  if (getRuntimeEnvironment() === "development") {
    throw new Error(errorMessage);
  } else {
    console.warn(errorMessage);
  }
}

// SSR Rules Error
const createSSRRulesError = (message: string) =>
  `@generaltranslation/react-core Failed to translate "${message}" because it is being used in an SSR environment at the module level. Please use an msg() function instead, and translate with an m() function. See: https://generaltranslation.com/en-US/docs/react/api/strings/msg`;

/**
 * Overloaded type for the `t` function.
 * - Tagged template: t`Hello, ${name}` (transformed by the compiler plugin at build time)
 * - Function call: t("Hello, {name}", { name: "John" })
 *
 * {@link TemplateSyncResolutionFunction}
 * {@link SyncResolutionFunction}
 */
interface StringOrTemplateSyncResolutionFunction {
  (strings: TemplateStringsArray, ...values: unknown[]): string;
  (message: string, options?: InlineTranslationOptions): string;
}

/**
 * Type for the `t` function when used as a tagged template literal.
 * @param strings - The template strings.
 * @param values - The values to interpolate.
 * @returns The translated message.
 */
type TemplateSyncResolutionFunction = (
  strings: TemplateStringsArray,
  ...values: unknown[]
) => string;
