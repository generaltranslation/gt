import { NextConfig } from 'next';
import { type BaseWithGTConfigProps } from '../../config-dir/props/withGTConfigProps';
import {
  experimentalLocaleResolutionDeprecatedWarning,
  createCacheComponentsMissingRequestFunctionsWarning,
  type CacheComponentsRequestFunction,
  cacheComponentsLegacySsgConflictError,
  cacheComponentsExperimentalLocaleResolutionDisableCustomGetLocaleWarning,
  cacheComponentsNonLocalTranslationsWarning,
  experimentalLocaleResolutionWithoutCacheComponentsWarning,
  cacheComponentsExperimentalFeatureDisableGetRequestFunctionWarning,
} from '../../errors/cacheComponents';
import { RequestFunctionPaths } from '../../config-dir/utils/resolveRequestFunctionPaths';

export function cacheComponentsChecks({
  mergedConfig,
  nextConfig,
  requestFunctionPaths,
  localTranslationsEnabled,
  localDictionaryEnabled,
}: {
  mergedConfig: BaseWithGTConfigProps;
  nextConfig: NextConfig;
  requestFunctionPaths: RequestFunctionPaths;
  localTranslationsEnabled: boolean;
  localDictionaryEnabled: boolean;
}) {
  // Check: if cacheComponents is enabled, but no local translations or dictionary are enabled, warn
  // this is necessary because it prevents executing a fetch when no local translations or dictionary are enabled
  if (
    nextConfig.cacheComponents &&
    !localTranslationsEnabled &&
    !localDictionaryEnabled
  ) {
    console.warn(cacheComponentsNonLocalTranslationsWarning);
  }

  if (nextConfig.cacheComponents) {
    const missingRequestFunctions: CacheComponentsRequestFunction[] = [];
    if (!requestFunctionPaths.getLocale) {
      missingRequestFunctions.push('getLocale');
    }
    if (!requestFunctionPaths.getRegion) {
      missingRequestFunctions.push('getRegion');
    }

    if (missingRequestFunctions.length) {
      console.warn(
        createCacheComponentsMissingRequestFunctionsWarning(
          missingRequestFunctions
        )
      );
    }
  }

  if (!mergedConfig.experimentalLocaleResolution) {
    return;
  }

  console.warn(experimentalLocaleResolutionDeprecatedWarning);

  // Warn that getRegion and getDomain are disabled
  console.warn(
    cacheComponentsExperimentalFeatureDisableGetRequestFunctionWarning
  );

  if (mergedConfig.experimentalEnableSSG) {
    // Error if experimentalEnableSSG is enabled (conflicts, and we want to move people away from this legacy feature)
    throw new Error(cacheComponentsLegacySsgConflictError);
  }

  if (requestFunctionPaths.getLocale) {
    // Warn that the custom getLocale function will be ignored
    console.warn(
      cacheComponentsExperimentalLocaleResolutionDisableCustomGetLocaleWarning
    );
  }

  if (!nextConfig.cacheComponents) {
    // Warn that experimentalLocaleResolution is meant to be used with cacheComponents
    console.warn(experimentalLocaleResolutionWithoutCacheComponentsWarning);
  }
}
