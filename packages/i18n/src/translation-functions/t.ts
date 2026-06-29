import {
  resolveStringContent,
  resolveStringContentWithFallback,
} from './internal/helpers';
import { GTTranslationOptions } from './types/options';
import { getLocale } from '../helpers/locale';

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
