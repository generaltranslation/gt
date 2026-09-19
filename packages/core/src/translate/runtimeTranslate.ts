import {
  resolveCanonicalLocale,
  standardizeLocale,
} from '@generaltranslation/format';
import type {
  TranslateConfig,
  TranslateManyResult,
  TranslationError,
  TranslationRequestConfig,
  TranslationResult,
} from '../types';
import type {
  TranslateManyEntry,
  TranslateOptions,
} from '../types-dir/api/entry';
import { libraryDefaultLocale } from '../settings/settings';
import {
  noApiKeyProvidedError,
  noProjectIdProvidedError,
  noTargetLocaleProvidedError,
} from '../logging/errors';
import { gtInstanceLogger } from '../logging/logger';
import { _translateMany } from './translateMany';

type TranslateFunctionName = 'translate' | 'translateMany';

/**
 * @internal
 * Credential/provider errors are reported before the project error, and both
 * before any locale validation. GT/GTRuntime share this ordering.
 */
export function validateTranslationAuth<
  T extends Pick<TranslateConfig, 'apiKey' | 'userTokenProvider' | 'projectId'>,
>(
  functionName: string,
  config: T
): asserts config is T & { projectId: string } {
  const errors: string[] = [];
  if (!config.apiKey && !config.userTokenProvider) {
    errors.push(noApiKeyProvidedError(functionName));
  }
  if (!config.projectId) {
    errors.push(noProjectIdProvidedError(functionName));
  }
  if (errors.length) {
    throw new Error(errors.join('\n'));
  }
}

/**
 * @internal
 *
 * Shared preparation for every translation surface (named helpers, classes and
 * the tooling facade): normalize the string shorthand, validate auth, require a
 * target locale, default the source locale and canonicalize both for the wire.
 *
 * @param defaults - Instance defaults supplied by GT/GTRuntime. Named and facade calls pass none.
 */
export function prepareTranslation(
  functionName: TranslateFunctionName,
  options: string | TranslateOptions,
  config: TranslateConfig,
  defaults: { sourceLocale?: string; targetLocale?: string } = {}
): {
  options: TranslateOptions & { sourceLocale: string };
  config: TranslationRequestConfig;
} {
  if (typeof options === 'string') {
    options = { targetLocale: options };
  }

  validateTranslationAuth(functionName, config);

  const targetLocale = options?.targetLocale || defaults.targetLocale;
  if (!targetLocale) {
    const error = noTargetLocaleProvidedError(functionName);
    gtInstanceLogger.error(error);
    throw new Error(error);
  }

  const { customMapping, ...requestConfig } = config;
  // Mapping resolves aliases; standardization also canonicalizes configured
  // spellings such as en-us before they cross the service boundary.
  const resolveServiceLocale = (locale: string) =>
    standardizeLocale(resolveCanonicalLocale(locale, customMapping));

  return {
    options: {
      ...options,
      targetLocale: resolveServiceLocale(targetLocale),
      sourceLocale: resolveServiceLocale(
        options?.sourceLocale || defaults.sourceLocale || libraryDefaultLocale
      ),
    },
    config: requestConfig,
  };
}

/**
 * Translates a single entry without constructing a GT instance.
 * Configuration is explicit: nothing is read from the environment.
 *
 * @example
 * const result = await translate('Hello', 'es', {
 *   projectId: 'project_123',
 *   apiKey: process.env.GT_API_KEY,
 *   timeoutMs: 10_000,
 * });
 */
export async function translate(
  source: TranslateManyEntry,
  options: string | TranslateOptions,
  config: TranslateConfig
): Promise<TranslationResult | TranslationError> {
  const prepared = prepareTranslation('translate', options, config);
  const results = await _translateMany(
    [source],
    prepared.options,
    prepared.config
  );
  return results[0];
}

/**
 * Translates multiple entries in one request without constructing a GT instance.
 * Returns an array for array input and a record for record input.
 * Configuration is explicit: nothing is read from the environment.
 *
 * @example
 * const results = await translateMany(['Hello', 'Goodbye'], { targetLocale: 'es' }, {
 *   projectId: 'project_123',
 *   apiKey: process.env.GT_API_KEY,
 * });
 */
export async function translateMany(
  sources: TranslateManyEntry[],
  options: string | TranslateOptions,
  config: TranslateConfig
): Promise<TranslateManyResult>;
export async function translateMany(
  sources: Record<string, TranslateManyEntry>,
  options: string | TranslateOptions,
  config: TranslateConfig
): Promise<Record<string, TranslationResult>>;
export async function translateMany(
  sources: TranslateManyEntry[] | Record<string, TranslateManyEntry>,
  options: string | TranslateOptions,
  config: TranslateConfig
): Promise<TranslateManyResult | Record<string, TranslationResult>>;
export async function translateMany(
  sources: TranslateManyEntry[] | Record<string, TranslateManyEntry>,
  options: string | TranslateOptions,
  config: TranslateConfig
): Promise<TranslateManyResult | Record<string, TranslationResult>> {
  const prepared = prepareTranslation('translateMany', options, config);
  return await _translateMany(sources, prepared.options, prepared.config);
}
