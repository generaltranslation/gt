import {
  createLookupOptions,
  getRuntimeEnvironment,
  interpolateMessage,
} from 'gt-i18n/internal';
import type { LookupOptions, LookupOptionsFor } from 'gt-i18n/internal/types';
import type { GTTranslationOptions } from 'gt-i18n/types';
import { createDiagnosticMessage } from 'generaltranslation/internal';
import type { StringContent, StringFormat } from 'generaltranslation/types';
import {
  getReadonlyConditionStore,
  isReadonlyConditionStoreInitialized,
} from '../../condition-store/singleton-operations';
import { getShouldTranslate } from '../../hooks/utils/getShouldTranslate';
import { getI18nConfig } from '../../setup/i18nConfig';

export type SyncTranslationLookup = (
  locale: string,
  message: StringContent,
  options: LookupOptions
) => StringContent | undefined;

export function createT(
  lookupTranslation: SyncTranslationLookup
): StringOrTemplateSyncResolutionFunction {
  function resolveStringContent(
    locale: string,
    content: StringContent,
    options: LookupOptionsFor<StringFormat> = {}
  ): StringContent {
    const defaultLocale = getI18nConfig().getDefaultLocale();
    const lookupOptions = createLookupOptions(locale, options, 'ICU');
    if (!getShouldTranslate()) {
      return interpolateMessage({
        options: lookupOptions,
        source: content,
        sourceLocale: defaultLocale,
      });
    }

    const translation = lookupTranslation(
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

  return (messageOrStrings, ...values) => {
    enforceSSRRules(messageOrStrings);

    if (typeof messageOrStrings === 'string') {
      const options = values.at(0) as GTTranslationOptions | undefined;
      const locale = options?.$locale ?? getLocale();
      return resolveStringContent(locale, messageOrStrings, options);
    }

    const locale = getLocale();
    const interpolatedTemplate = interpolateTemplateLiteral(
      messageOrStrings,
      values
    );
    const translatedInterpolatedTemplate = lookupTranslation(
      locale,
      interpolatedTemplate,
      { $format: 'STRING' }
    );
    if (translatedInterpolatedTemplate) return translatedInterpolatedTemplate;

    const { message, variables } = extractInterpolatableValues(
      messageOrStrings,
      values
    );
    return resolveStringContent(locale, message, variables);
  };
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

function interpolateTemplateLiteral(
  strings: TemplateStringsArray,
  values: unknown[]
): string {
  return strings
    .map((string, index) => string + (values[index] ?? ''))
    .join('');
}

function enforceSSRRules(
  messageOrStrings: string | TemplateStringsArray
): void {
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
  if (runtimeEnvironment === 'development') {
    throw new Error(errorMessage);
  }
  console.error(errorMessage);
}

function getLocale(): string {
  return getReadonlyConditionStore().getLocale();
}

export interface StringOrTemplateSyncResolutionFunction {
  (strings: TemplateStringsArray, ...values: unknown[]): string;
  (message: string, options?: GTTranslationOptions): string;
}
