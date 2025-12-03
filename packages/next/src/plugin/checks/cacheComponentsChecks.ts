import { NextConfig } from 'next';
import withGTConfigProps from '../../config-dir/props/withGTConfigProps';
import {
  cacheComponentsExperimentalFeatureWarning,
  cacheComponentsMissingExperimentalLocaleResolutionWarning,
  cacheComponentLegacySsgConflictError,
} from '../../errors/cacheComponents';

export function cacheComponentsChecks(
  mergedConfig: withGTConfigProps,
  nextConfig: NextConfig
) {
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

  if (mergedConfig.experimentalEnableSSG) {
    // Error if experimentalEnableSSG is enabled (conflicts, and we want to move people away from this legacy feature)
    throw new Error(cacheComponentLegacySsgConflictError);
  }
}
