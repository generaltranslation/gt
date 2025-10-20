import { useEffect } from 'react';
import {
  apiKeyInProductionError,
  APIKeyMissingWarn,
  projectIdMissingWarning,
} from '../../errors-dir/createErrors';
import {
  defaultCacheUrl,
  defaultRuntimeApiUrl,
} from 'generaltranslation/internal';
import { createUnsupportedLocalesWarning } from '../../errors-dir/createErrors';
import { getSupportedLocale } from '@generaltranslation/supported-locales';

export function useErrorChecks({
  devApiKey,
  projectId,
  runtimeUrl,
  loadTranslationsType,
  cacheUrl,
  locales,
}: {
  devApiKey?: string;
  projectId: string;
  runtimeUrl: string;
  loadTranslationsType: string;
  cacheUrl: string;
  locales: string[];
}) {
  useEffect(() => {
    // Check: no devApiKey in production
    if (
      typeof process !== 'undefined' &&
      process.env.NODE_ENV === 'production' &&
      devApiKey
    ) {
      throw new Error(apiKeyInProductionError);
    }

    // Check: projectId missing while using cache/runtime in dev
    if (
      loadTranslationsType !== 'custom' &&
      (cacheUrl || runtimeUrl) &&
      !projectId &&
      typeof process !== 'undefined' &&
      process.env.NODE_ENV === 'development'
    ) {
      console.warn(projectIdMissingWarning);
    }

    // Check: An API key is required for runtime translation
    if (
      projectId && // must have projectId for this check to matter anyways
      runtimeUrl &&
      loadTranslationsType !== 'custom' && // this usually conincides with not using runtime tx
      !devApiKey &&
      typeof process !== 'undefined' &&
      process.env.NODE_ENV === 'development'
    ) {
      console.warn(APIKeyMissingWarn);
    }

    // Check: if using GT infrastructure, warn about unsupported locales
    if (
      runtimeUrl === defaultRuntimeApiUrl ||
      (cacheUrl === defaultCacheUrl && loadTranslationsType === 'default')
    ) {
      const warningLocales = locales.filter(
        (locale) => !getSupportedLocale(locale)
      );
      if (warningLocales.length) {
        console.warn(createUnsupportedLocalesWarning(warningLocales));
      }
    }
  }, [
    devApiKey,
    loadTranslationsType,
    cacheUrl,
    runtimeUrl,
    projectId,
    locales,
  ]);
}
