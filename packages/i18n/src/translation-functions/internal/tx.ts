import { RuntimeTranslationOptions } from '../types/options';
import type { StringFormat } from '@generaltranslation/format/types';
import {
  prefetchStringContentWithRuntimeFallback,
  resolveStringContentWithRuntimeFallback,
} from './helpers';
import { getI18nConfig } from '../../i18n-config/singleton-operations';
import { getWritableConditionStore } from '../../condition-store/singleton-operations';

type RuntimeTranslationOptionsWithFormat = Omit<
  RuntimeTranslationOptions,
  '$format'
> & {
  $format?: StringFormat;
};

/**
 * Translates a message at runtime.
 * @param {string} message - The message to translate.
 * @param {RuntimeTranslationOptions} options - The options for the translation.
 * @returns {Promise<string>} The translated message.
 *
 * @example
 * // Simple runtime translation without interpolation
 * const status = await tx('Processing complete', { $locale: 'es-MX' });
 *
 * @example
 * // Runtime translation with interpolation
 * const progress = await tx(`Processing ${status}`, { $locale: 'es-MX' });
 */
export async function tx(
  content: string,
  options: RuntimeTranslationOptionsWithFormat = {}
): Promise<string> {
  const conditionStore = getWritableConditionStore();
  const locale = conditionStore.getLocale();
  const enableI18n = conditionStore.getEnableI18n();

  return txInternal({ locale, enableI18n, content, options });
}

/**
 * Condition store agnostic tx function
 */
export async function txInternal({
  locale,
  enableI18n,
  content,
  options,
}: {
  locale: string;
  enableI18n: boolean;
  content: string;
  options: RuntimeTranslationOptionsWithFormat;
}): Promise<string> {
  const targetLocale = getTargetLocale({ locale, enableI18n, options });
  return resolveStringContentWithRuntimeFallback(targetLocale, content, {
    $format: 'STRING',
    ...options,
  });
}

/**
 * Registers a message for runtime translation without interpolating the
 * result. For compiler-injected prefetch calls: their return value is
 * discarded and variable values only exist at the render-time call site, so
 * interpolating here would fail for any message with placeholders.
 */
export async function txPrefetch(
  content: string,
  options: RuntimeTranslationOptionsWithFormat = {}
): Promise<void> {
  const conditionStore = getWritableConditionStore();
  const locale = conditionStore.getLocale();
  const enableI18n = conditionStore.getEnableI18n();
  const targetLocale = getTargetLocale({ locale, enableI18n, options });
  await prefetchStringContentWithRuntimeFallback(targetLocale, content, {
    $format: 'STRING',
    ...options,
  });
}

function getTargetLocale({
  locale,
  enableI18n,
  options,
}: {
  locale: string;
  enableI18n: boolean;
  options: RuntimeTranslationOptionsWithFormat;
}): string {
  return enableI18n
    ? typeof options.$locale === 'string'
      ? options.$locale
      : locale
    : getI18nConfig().getDefaultLocale();
}
