import {
  resolveStringContent,
  resolveStringContentWithFallback,
} from './internal/helpers';
import { GTTranslationOptions } from './types/options';
import { getDefaultLocale } from '../helpers/locale';
import { getWritableConditionStore } from '../condition-store/singleton-operations';
import type { InlineTranslations } from './inline/inlineTranslations';

/**
 * Translate a message
 * @param {string} message - The message to translate.
 * @param options - The options for the translation.
 * @param inline - Translations embedded at the call site, checked before loaded translations. Usually injected at build time.
 * @returns The translated message.
 */
export const t: StringOrTemplateSyncResolutionFunction = (
  messageOrStrings: string | TemplateStringsArray,
  ...values: unknown[]
) => {
  if (typeof messageOrStrings === 'string') {
    const options = values.at(0) as GTTranslationOptions | undefined;
    const inline = values.at(1) as InlineTranslations<string> | undefined;
    const conditionStore = getWritableConditionStore();
    const locale = conditionStore.getEnableI18n()
      ? (options?.$locale ?? conditionStore.getLocale())
      : getDefaultLocale();
    return resolveStringContentWithFallback(
      locale,
      messageOrStrings,
      { $format: 'ICU', ...options },
      inline
    );
  }

  return handleTaggedTemplateLiteralTranslation(messageOrStrings, values);
};

function handleTaggedTemplateLiteralTranslation(
  messageOrStrings: TemplateStringsArray,
  values: unknown[]
): string {
  const conditionStore = getWritableConditionStore();
  const locale = conditionStore.getEnableI18n()
    ? conditionStore.getLocale()
    : getDefaultLocale();
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
  (
    message: string,
    options?: GTTranslationOptions,
    inline?: InlineTranslations<string>
  ): string;
}

export type TemplateSyncResolutionFunction = (
  strings: TemplateStringsArray,
  ...values: unknown[]
) => string;
