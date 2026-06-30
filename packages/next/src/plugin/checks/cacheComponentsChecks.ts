import { NextConfig } from 'next';
import {
  createCacheComponentsMissingRequestFunctionsWarning,
  type CacheComponentsRequestFunction,
  cacheComponentsNonLocalTranslationsWarning,
} from '../../errors/cacheComponents';
import { RequestFunctionPaths } from '../../config-dir/utils/resolveRequestFunctionPaths';

export function cacheComponentsChecks({
  nextConfig,
  requestFunctionPaths,
  localTranslationsEnabled,
  localDictionaryEnabled,
}: {
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
}
