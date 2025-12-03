import { NextConfig } from 'next';
import withGTConfigProps from '../../config-dir/props/withGTConfigProps';
import { cacheComponentsMissingExperimentalLocaleResolutionWarning } from '../../errors/cacheComponents';

export function cacheComponentsChecks(
  mergedConfig: withGTConfigProps,
  nextConfig: NextConfig
) {
  if (!nextConfig.cacheComponents) return;

  if (!mergedConfig.experimentalLocaleResolution) {
    console.warn(cacheComponentsMissingExperimentalLocaleResolutionWarning);
  }
}
