import { createLookupOptions, interpolateMessage } from 'gt-i18n/internal';
import type { GTTranslationOptions, LookupOptionsFor } from 'gt-i18n';
import { getI18nConfig } from '../../setup/i18nConfig';
import { getReadonlyConditionStore } from '../../condition-store/singleton-operations';
import type { StringContent, StringFormat } from '@generaltranslation/format';
import { getReactI18nCache } from '../../i18n-cache/singleton-operations';
import { getShouldTranslate } from '../../hooks/utils/getShouldTranslate';
import { isSpa, reportServerRenderedUse } from '../../unstable/spaOnly';

/**
 * Translate a message
 *
 * Only available in client-rendered (SPA) apps, where it also works at module
 * level. Server-rendered apps, client-side code included, use useGT() in
 * components, getGT() in loaders and server functions, or msg() with m().
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
  const outsideSpa = reportOutsideSpa(
    typeof messageOrStrings === 'string'
      ? messageOrStrings
      : messageOrStrings.join('')
  );

  //  t("Hello, {name}!", { name: "John" })
  if (typeof messageOrStrings === 'string') {
    const [first] = values;
    const options = isTranslationOptions(first) ? first : undefined;
    if (outsideSpa) return renderSource(messageOrStrings, options ?? {});
    const locale = options?.$locale ?? getLocale();
    return resolveStringContent(
      locale,
      messageOrStrings,
      createLookupOptions(locale, options ?? {}, 'ICU')
    );
  }

  // t`Hello, ${name}`
  return outsideSpa
    ? interpolateTemplateLiteral(messageOrStrings, values)
    : handleTaggedTemplateLiteralTranslation(messageOrStrings, values);
};

function isTranslationOptions(value: unknown): value is GTTranslationOptions {
  return typeof value === 'object' && value !== null;
}

function reportOutsideSpa(message: string): boolean {
  if (isSpa()) return false;
  reportServerRenderedUse({
    name: 't',
    fix: 'In a server-rendered app, client-side code included, register the string with msg() and render it with m() from useMessages() or getMessages(), or use useGT() in components and getGT() in loaders and server functions',
    message,
  });
  return true;
}

function renderSource(
  message: string,
  options: LookupOptionsFor<StringFormat>
): string {
  const defaultLocale = getI18nConfig().getDefaultLocale();
  return interpolateMessage({
    options: createLookupOptions(defaultLocale, options, 'ICU'),
    source: message,
    sourceLocale: defaultLocale,
  });
}

// ----- Helper Functions ----- //

export function resolveStringContent(
  locale: string,
  content: StringContent,
  options: LookupOptionsFor<StringFormat> = {}
): StringContent {
  const i18nCache = getReactI18nCache();
  const defaultLocale = getI18nConfig().getDefaultLocale();
  if (!getShouldTranslate()) {
    return interpolateMessage({
      options,
      source: content,
      sourceLocale: defaultLocale,
    });
  }

  const lookupOptions = createLookupOptions(locale, options, 'ICU');
  const translation = i18nCache.lookupTranslation(
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
  const i18nCache = getReactI18nCache();
  const translatedInterpolatedTemplate = i18nCache.lookupTranslation(
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

function getLocale(): string {
  return getReadonlyConditionStore().getLocale();
}

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
  (message: string, options?: GTTranslationOptions): string;
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
