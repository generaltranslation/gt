import { ROOT_PARAM_STABILITY } from '../plugin/constants';
import { RequestFunctions, StaticRequestFunctions } from '../request/types';

// ========== ERRORS ========== //

export const ssgMissingGetStaticLocaleFunctionError =
  'gt-next: You have enabled SSG, but you have not configured a custom getStaticLocale() function. Please visit https://generaltranslation.com/en/docs/next/guides/ssg to configure SSG.';

export const ssgInvalidNextVersionError = `gt-next: SSG support in gt-next is only available for Next.js ${ROOT_PARAM_STABILITY.unstable} and higher. Please visit https://generaltranslation.com/en/docs/next/guides/ssg to configure SSG.`;

// ========== WARNINGS ========== //

// This was (1) triggered by SSG without running middleware, or (2) triggered by a request with no locale headers (also no middleware).
export const noLocalesCouldBeDeterminedWarning =
  'gt-next: no locales could be determined for this request. If you are using SSG, make sure to follow set up instructions here: https://generaltranslation.com/en/docs/next/guides/ssg#ssg-custom-get-locale';

const createCustomSSGFunctionSuffix = (functionName: StaticRequestFunctions) =>
  `If you wish to use ${functionName.replace('Static', '')} during SSG, please define a custom ${functionName.replace('Static', '')}() function for SSG. For more information, visit https://generaltranslation.com/en/docs/next/guides/ssg. To disable this warning, set "disableSSGWarnings" to true.`;

export const createSsgMissingCustomFunctionWarning = (
  functionName: StaticRequestFunctions
) =>
  process.env._GENERALTRANSLATION_DISABLE_SSG_WARNINGS === 'true'
    ? ''
    : `gt-next: ${functionName.replace('Static', '')}() was invoked during SSG. ${createCustomSSGFunctionSuffix(functionName)}`;

export const invalidSSGConfigurationWarning =
  'gt-next: You are using SSG, but you have not configured SSG in your withGTConfig() plugin. Please visit https://generaltranslation.com/en/docs/next/guides/ssg to configure SSG.';

export const createGetRequestFunctionWarning = (
  functionName: RequestFunctions | StaticRequestFunctions
) => `gt-next: Unable to resolve ${functionName} function.`;

export const createCustomGetRequestFunctionWarning = (
  functionName: RequestFunctions | StaticRequestFunctions
) => `gt-next: Unable to resolve custom ${functionName} function.`;

export const createSsrFunctionDuringSsgWarning = (
  functionName: RequestFunctions
) =>
  process.env._GENERALTRANSLATION_DISABLE_SSG_WARNINGS === 'true'
    ? ''
    : `gt-next: ${functionName}() was invoked during SSG. Rendering will like fallback to SSR behavior`;

export const ssrDetectionFailedWarning =
  'gt-next: Unable to determine if runtime is SSR or SSG. Falling back to SSR behavior.';
