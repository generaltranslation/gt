// ========== ERRORS ========== //

export const noCustomLocaleEnabledSSGError = `gt-next Error: You are using SSG, but you have not set a custom getLocale() function. Please set a custom getLocale() function to use SSG. For more information, visit https://generaltranslation.com/en/docs/next/guides/ssg#ssg-custom-get-locale`;

// ========== WARNINGS ========== //

// This was (1) triggered by SSG without running middleware, or (2) triggered by a request with no locale headers (also no middleware).
export const noLocalesCouldBeDeterminedWarning =
  'gt-next: no locales could be determined for this request. If you are using SSG, make sure to follow set up instructions here: https://generaltranslation.com/en/docs/next/guides/ssg#ssg-custom-get-locale';

const createCustomSSGFunctionSuffix = (
  functionName: 'getRegion' | 'getDomain'
) =>
  `If you wish to use ${functionName} please define a custom ${functionName}() function for SSG. For more information, visit https://generaltranslation.com/en/docs/next/guides/ssg. To disable this warning, set "disableSSGWarnings" to true.`;

export const createFallbackCustomRequestFunctionWarning = (
  functionName: 'getRegion' | 'getDomain'
) =>
  process.env._GENERALTRANSLATION_DISABLE_SSG_WARNINGS === 'true'
    ? ''
    : `gt-next: ${functionName}() was invoked during SSG. ${createCustomSSGFunctionSuffix(functionName)}`;

export const invalidSSGConfigurationWarning =
  'gt-next: You are using SSG, but you have not configured SSG in your withGTConfig() plugin. Please visit https://generaltranslation.com/en/docs/next/guides/ssg to configure SSG.';
