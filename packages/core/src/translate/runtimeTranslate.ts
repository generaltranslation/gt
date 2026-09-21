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
type TranslateDefaults = Partial<
  Pick<TranslateOptions, 'sourceLocale' | 'targetLocale'>
>;

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
 * Shared preparation for every translation surface (classes and the tooling
 * facade): normalize the string shorthand, validate auth, require a target
 * locale, default the source locale and canonicalize both for the wire.
 *
 * @param defaults - Instance defaults supplied by GT/GTRuntime. Facade calls pass none.
 */
function prepareTranslation(
  functionName: TranslateFunctionName,
  options: string | TranslateOptions,
  config: TranslateConfig,
  defaults: TranslateDefaults = {}
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
 * @internal
 * Translates a single entry with explicit configuration and optional locale defaults.
 */
export async function translate(
  source: TranslateManyEntry,
  options: string | TranslateOptions,
  config: TranslateConfig,
  defaults?: TranslateDefaults
): Promise<TranslationResult | TranslationError> {
  const prepared = prepareTranslation('translate', options, config, defaults);
  const results = await _translateMany(
    [source],
    prepared.options,
    prepared.config
  );
  return results[0];
}

/**
 * @internal
 * Translates multiple entries in one request with explicit configuration.
 * Returns an array for array input and a record for record input.
 */
export async function translateMany(
  sources: TranslateManyEntry[],
  options: string | TranslateOptions,
  config: TranslateConfig,
  defaults?: TranslateDefaults
): Promise<TranslateManyResult>;
export async function translateMany(
  sources: Record<string, TranslateManyEntry>,
  options: string | TranslateOptions,
  config: TranslateConfig,
  defaults?: TranslateDefaults
): Promise<Record<string, TranslationResult>>;
export async function translateMany(
  sources: TranslateManyEntry[] | Record<string, TranslateManyEntry>,
  options: string | TranslateOptions,
  config: TranslateConfig,
  defaults?: TranslateDefaults
): Promise<TranslateManyResult | Record<string, TranslationResult>>;
export async function translateMany(
  sources: TranslateManyEntry[] | Record<string, TranslateManyEntry>,
  options: string | TranslateOptions,
  config: TranslateConfig,
  defaults?: TranslateDefaults
): Promise<TranslateManyResult | Record<string, TranslationResult>> {
  const prepared = prepareTranslation(
    'translateMany',
    options,
    config,
    defaults
  );
  return await _translateMany(sources, prepared.options, prepared.config);
}
