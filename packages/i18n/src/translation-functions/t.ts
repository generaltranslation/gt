import { getI18nCache } from '../i18n-cache/singleton-operations';
import { getI18nConfig } from '../i18n-config/singleton-operations';
import { GTTranslationOptions } from './types/options';
import { getLocale } from '../helpers/locale';
import { interpolateMessage } from './utils/interpolation/interpolateMessage';
import { createLookupOptions } from './internal/createLookupOptions';
import type {
  StringContent,
  StringFormat,
} from '@generaltranslation/format/types';
import type { LookupOptionsFor } from './types/options';

/**
 * Translate a message
 * @param {string} message - The message to translate.
 * @param options - The options for the translation.
 * @returns The translated message.
 */
export const t: StringOrTemplateSyncResolutionFunction = (
  messageOrStrings: string | TemplateStringsArray,
  ...values: unknown[]
) => {
  if (typeof messageOrStrings === 'string') {
    const options = values.at(0) as GTTranslationOptions | undefined;
    const locale = options?.$locale ?? getLocale();
    return resolveStringContentWithFallback(locale, messageOrStrings, {
      $format: 'ICU',
      ...options,
    });
  }

  return handleTaggedTemplateLiteralTranslation(messageOrStrings, values);
};

function handleTaggedTemplateLiteralTranslation(
  messageOrStrings: TemplateStringsArray,
  values: unknown[]
): string {
  const locale = getLocale();
  const interpolatedTemplate = messageOrStrings
    .map((string, index) => string + (values[index] ?? ''))
    .join('');
  const translatedInterpolatedTemplate = resolveStringContent(
    locale,
    interpolatedTemplate,
    { $format: 'ICU' }
  );
  if (translatedInterpolatedTemplate !== undefined) {
    return translatedInterpolatedTemplate;
  }

  const { message, variables } = extractInterpolatableValues(
    messageOrStrings,
    values
  );
  return resolveStringContentWithFallback(locale, message, {
    $format: 'ICU',
    ...variables,
  });
}

function extractInterpolatableValues(
  strings: TemplateStringsArray,
  values: unknown[]
): {
  message: string;
  variables: Record<string, unknown>;
} {
  const parts: string[] = [];
  const variables: Record<string, unknown> = {};
  let varIndex = 0;

  for (let i = 0; i < strings.length; i++) {
    parts.push(strings[i]);

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

interface StringOrTemplateSyncResolutionFunction {
  (strings: TemplateStringsArray, ...values: unknown[]): string;
  (message: string, options?: GTTranslationOptions): string;
}

export type TemplateSyncResolutionFunction = (
  strings: TemplateStringsArray,
  ...values: unknown[]
) => string;

/**
 * Just do a simple lookup of the translation
 * And interpolate
 */
export function resolveStringContent(
  locale: string,
  content: StringContent,
  options: LookupOptionsFor<StringFormat> = {}
): StringContent | undefined {
  const i18nCache = getI18nCache();
  const lookupOptions = createLookupOptions(locale, options, 'STRING');
  const translation = i18nCache.lookupTranslation(
    lookupOptions.$locale,
    content,
    lookupOptions
  );
  if (translation == null) return undefined;
  return interpolateMessage({
    source: content,
    target: translation,
    options: lookupOptions,
    sourceLocale: getI18nConfig().getDefaultLocale(),
  });
}

/**
 * Lookup translation, fallback to source
 */
export function resolveStringContentWithFallback(
  locale: string,
  content: StringContent,
  options: LookupOptionsFor<StringFormat> = {}
): StringContent {
  const i18nCache = getI18nCache();
  const lookupOptions = createLookupOptions(locale, options, 'STRING');
  const translation = i18nCache.lookupTranslation(
    lookupOptions.$locale,
    content,
    lookupOptions
  );
  return interpolateMessage({
    source: content,
    target: translation,
    options: lookupOptions,
    sourceLocale: getI18nConfig().getDefaultLocale(),
  });
}

/**
 * Lookup translation
 * fallback to runtime translate
 * Fallback to source
 */
export async function resolveStringContentWithRuntimeFallback(
  locale: string,
  content: StringContent,
  options: LookupOptionsFor<StringFormat> = {}
): Promise<StringContent> {
  const i18nCache = getI18nCache();
  const lookupOptions = createLookupOptions(locale, options, 'STRING');
  const translation = await i18nCache.lookupTranslationWithFallback(
    lookupOptions.$locale,
    content,
    lookupOptions
  );
  return interpolateMessage({
    source: content,
    target: translation,
    options: lookupOptions,
    sourceLocale: getI18nConfig().getDefaultLocale(),
  });
}
