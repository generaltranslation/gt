import {
  deprecatedExperimentalEnableSSGWarning,
  ssgMissingGetStaticLocaleFunctionError,
} from '../../errors/ssg';
import { type withGTConfigProps } from '../../config-dir/props/withGTConfigProps';
import { RequestFunctionPaths } from '../../config-dir/utils/resolveRequestFunctionPaths';

export function ssgChecks(
  mergedConfig: withGTConfigProps,
  requestFunctionPaths: RequestFunctionPaths
) {
  // Check (warn): if using deprecated experimentalEnableSSG configuration
  if (mergedConfig.experimentalEnableSSG) {
    console.warn(deprecatedExperimentalEnableSSGWarning);
  }

  // Check: if using SSG, error on missing getStaticLocale function
  if (
    mergedConfig.experimentalEnableSSG &&
    !requestFunctionPaths.getStaticLocale
  ) {
    throw new Error(ssgMissingGetStaticLocaleFunctionError);
  }
}
