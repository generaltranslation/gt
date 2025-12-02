import {
  createDeprecatedGetStaticLocaleFunctionWarning,
  deprecatedExperimentalEnableSSGWarning,
  ssgMissingGetStaticLocaleFunctionError,
} from '../../errors/ssg';
import withGTConfigProps, {
  DEPRECATED_REQUEST_FUNCTION_TO_CONFIG_KEY,
} from '../../config-dir/props/withGTConfigProps';
import { RequestFunctionPaths } from '../../config-dir/utils/resolveRequestFunctionPaths';
import { StaticRequestFunctions } from '../../request/types';

export default function ssgChecks(
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

  // Check (warn): if using deprecated getStaticLocale function
  for (const functionName of Object.keys(
    DEPRECATED_REQUEST_FUNCTION_TO_CONFIG_KEY
  )) {
    if (requestFunctionPaths[functionName as StaticRequestFunctions]) {
      console.warn(
        createDeprecatedGetStaticLocaleFunctionWarning(
          functionName as keyof typeof DEPRECATED_REQUEST_FUNCTION_TO_CONFIG_KEY
        )
      );
    }
  }
}
