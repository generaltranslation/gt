import { NextConfig } from 'next';
import withGTConfigProps from '../../config-dir/props/withGTConfigProps';
import {
  cacheComponentsExperimentalFeatureWarning,
  cacheComponentsMissingExperimentalLocaleResolutionWarning,
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
  mergedConfig: withGTConfigProps;
  nextConfig: NextConfig;
  requestFunctionPaths: RequestFunctionPaths;
  localTranslationsEnabled: boolean;
  localDictionaryEnabled: boolean;
}) {
  // Check: if cacheComponents is enabled, but no local translations or dictionary are enabled, error
  // this is necessary because it prevents executing a fetch when no local translations or dictionary are enabled
  if (
    nextConfig.cacheComponents &&
    !localTranslationsEnabled &&
    !localDictionaryEnabled
  ) {
    console.warn(cacheComponentsNonLocalTranslationsWarning);
  }

  // checks for disabled experimentalLocaleResolution
  if (!mergedConfig.experimentalLocaleResolution) {
    if (nextConfig.cacheComponents) {
      // Warn that i18n wont work inside of cached components
      console.warn(cacheComponentsMissingExperimentalLocaleResolutionWarning);
    }
    return;
  }

  // Warn that this is an experimental feature
  console.warn(cacheComponentsExperimentalFeatureWarning);

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
